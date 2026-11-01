import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db/index.js';
import { logAudit } from '../services/auditService.js';


export function generateSixDigitCode() {
  const num = crypto.randomInt(100000, 1000000);
  return num.toString();
}


export async function requestCode(req, res) {
  try {
    const email = (req.body?.email || '').trim().toLowerCase();
    const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';

    if (!email) {
      return res.status(400).json({ error: 'Validation Error', message: 'Email is required.' });
    }

    // 1. Verify user exists and is active
    const { rows: users } = await query(
      'SELECT id, email, full_name, role, is_active FROM users WHERE email = $1',
      [email]
    );

    if (users.length === 0 || !users[0].is_active) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'No active staff account found with this email.',
      });
    }


    // 2. Generate 6-digit code and hash it
    const plainCode = generateSixDigitCode();
    const salt = await bcrypt.genSalt(10);
    const codeHash = await bcrypt.hash(plainCode, salt);

    // 3. Expiry is 10 minutes from now
    const expiryMinutes = parseInt(process.env.MAGIC_CODE_EXPIRY_MINUTES, 10) || 10;
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    // 4. Invalidate any existing unused codes for this email
    await query(
      'UPDATE magic_codes SET is_used = TRUE WHERE email = $1 AND is_used = FALSE',
      [email]
    );

    // 5. Store the new code record
    await query(
      `INSERT INTO magic_codes (email, code_hash, attempts_count, max_attempts, is_used, expires_at, ip_address)
       VALUES ($1, $2, 0, 5, FALSE, $3, $4)`,
      [email, codeHash, expiresAt, ip]
    );

    // 6. In development, print code to console as instructed by the brief
    console.log('\n======================================================');
    console.log(`🔐 SWARN SATHI LOGIN CODE FOR: ${email}`);
    console.log(`👉 CODE: ${plainCode}`);
    console.log(`⏱️  Expires in ${expiryMinutes} minutes`);
    console.log('======================================================\n');

    return res.status(200).json({
      success: true,
      message: `A 6-digit magic code has been sent. (Check terminal console in development).`,
      email,
      expiresInMinutes: expiryMinutes,
    });
  } catch (err) {
    console.error('Request code error:', err);
    return res.status(500).json({ error: 'Server Error', message: 'Failed to generate login code.' });
  }
}


export async function verifyCode(req, res) {
  try {
    const email = (req.body?.email || '').trim().toLowerCase();
    const code = (req.body?.code || '').trim();

    if (!email || !code) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Both email and 6-digit code are required.',
      });
    }

    // 1. Fetch the latest active code record for this email
    const { rows: codeRecords } = await query(
      `SELECT * FROM magic_codes 
       WHERE email = $1 AND is_used = FALSE 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [email]
    );

    if (codeRecords.length === 0) {
      return res.status(400).json({
        error: 'Invalid Code',
        message: 'No active code found. Please request a new one.',
      });
    }

    const record = codeRecords[0];

    // 2. Check if code has expired (10 minutes)
    if (new Date() > new Date(record.expires_at)) {
      await query('UPDATE magic_codes SET is_used = TRUE WHERE id = $1', [record.id]);
      return res.status(400).json({
        error: 'Code Expired',
        message: 'This magic code has expired. Please request a new one.',
      });
    }

    // 3. Check attempt limit (Max 5 attempts)
    if (record.attempts_count >= record.max_attempts) {
      await query('UPDATE magic_codes SET is_used = TRUE WHERE id = $1', [record.id]);
      return res.status(400).json({
        error: 'Code Invalidated',
        message: 'Too many incorrect attempts. This code has been invalidated. Please request a new one.',
      });
    }

    // 4. Compare code with bcrypt hash
    const isMatch = await bcrypt.compare(code, record.code_hash);

    if (!isMatch) {
      const newAttempts = record.attempts_count + 1;
      const remainingAttempts = record.max_attempts - newAttempts;

      if (remainingAttempts <= 0) {
        await query(
          'UPDATE magic_codes SET attempts_count = $1, is_used = TRUE WHERE id = $2',
          [newAttempts, record.id]
        );
        return res.status(400).json({
          error: 'Code Invalidated',
          message: 'Incorrect code. Maximum attempts reached. Code has been invalidated.',
        });
      } else {
        await query(
          'UPDATE magic_codes SET attempts_count = $1 WHERE id = $2',
          [newAttempts, record.id]
        );
        return res.status(400).json({
          error: 'Invalid Code',
          message: `Incorrect code. You have ${remainingAttempts} attempt(s) remaining.`,
          remainingAttempts,
        });
      }
    }

    // 5. Success! Mark code as used (Single use rule)
    await query('UPDATE magic_codes SET is_used = TRUE WHERE id = $1', [record.id]);

    // 6. Fetch user details and issue JWT
    const { rows: users } = await query('SELECT * FROM users WHERE email = $1', [email]);
    const user = users[0];

    const secret = process.env.JWT_SECRET || 'swarn_sathi_secure_jwt_secret_dev_key_2026';
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: user.full_name,
      branchName: user.branch_name,
    };

    const token = jwt.sign(payload, secret, { expiresIn: '12h' });

    // 7. Audit log the login
    await logAudit({
      entityName: 'USER',
      entityId: user.id,
      action: 'LOGIN',
      performedByUserId: user.id,
      ipAddress: req.ip,
      details: { email: user.email, role: user.role },
    });

    return res.status(200).json({
      success: true,
      token,
      user: payload,
    });
  } catch (err) {
    console.error('Verify code error:', err);
    return res.status(500).json({ error: 'Server Error', message: 'Failed to verify code.' });
  }
}


export async function getCurrentUser(req, res) {
  return res.status(200).json({ user: req.user });
}