import { query } from '../db/index.js';
import { logAudit } from '../services/auditService.js';

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const AADHAAR_LAST_4_REGEX = /^[0-9]{4}$/;

/**
 * POST /api/customers
 * Create a new customer record
 */
export async function createCustomer(req, res) {
  try {
    const { fullName, phone, dateOfBirth, address, pan, aadhaarLast4 } = req.body;

    // 1. Validations
    if (!fullName || !phone || !dateOfBirth || !address || !pan || !aadhaarLast4) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'All fields are required (fullName, phone, dateOfBirth, address, pan, aadhaarLast4).',
      });
    }

    const cleanPan = pan.trim().toUpperCase();
    if (!PAN_REGEX.test(cleanPan)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid PAN format. Must be 5 uppercase letters, 4 digits, and 1 uppercase letter (e.g. ABCDE1234F).',
      });
    }

    const cleanAadhaar = aadhaarLast4.trim();
    if (!AADHAAR_LAST_4_REGEX.test(cleanAadhaar)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Aadhaar must be strictly the last 4 digits only (e.g. 5678). Do not store full Aadhaar.',
      });
    }

    // 2. Insert into database
    const insertSql = `
      INSERT INTO customers (full_name, phone, date_of_birth, address, pan, aadhaar_last_4, created_by_user_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    const { rows } = await query(insertSql, [
      fullName.trim(),
      phone.trim(),
      dateOfBirth,
      address.trim(),
      cleanPan,
      cleanAadhaar,
      req.user.id,
    ]);

    const customer = rows[0];

    // 3. Audit trail
    await logAudit({
      entityName: 'CUSTOMER',
      entityId: customer.id,
      action: 'CREATE',
      performedByUserId: req.user.id,
      ipAddress: req.ip,
      details: { fullName: customer.full_name, phone: customer.phone, pan: customer.pan },
    });

    return res.status(201).json({ success: true, customer });
  } catch (err) {
    console.error('Create customer error:', err);
    return res.status(500).json({ error: 'Server Error', message: 'Failed to create customer.' });
  }
}

/**
 * GET /api/customers
 * Paginated list and search for customers by Name, Phone, or PAN
 */
export async function getCustomers(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const offset = (page - 1) * limit;
    const search = (req.query.search || '').trim();

    // WITH THIS (Notice the alias 'c' added to customers):
    let countSql = 'SELECT COUNT(*) FROM customers c';
    let dataSql = `
      SELECT c.*, u.full_name as created_by_name 
      FROM customers c
      JOIN users u ON c.created_by_user_id = u.id
    `;
    const params = [];

    if (search) {
      const searchClause = ' WHERE c.full_name ILIKE $1 OR c.phone ILIKE $1 OR c.pan ILIKE $1';
      countSql += searchClause;
      dataSql += searchClause;
      params.push(`%${search}%`);
    }

    dataSql += ` ORDER BY c.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const dataParams = [...params, limit, offset];

    const [{ rows: countRows }, { rows: customers }] = await Promise.all([
      query(countSql, params),
      query(dataSql, dataParams),
    ]);

    const totalCount = parseInt(countRows[0].count, 10);

    return res.status(200).json({
      customers,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (err) {
    console.error('Get customers error:', err);
    return res.status(500).json({ error: 'Server Error', message: 'Failed to retrieve customers.' });
  }
}

/**
 * GET /api/customers/:id
 * Retrieve customer details and their loan/appraisal history
 */
export async function getCustomerById(req, res) {
  try {
    const { id } = req.params;
    const { rows: customers } = await query('SELECT * FROM customers WHERE id = $1', [id]);

    if (customers.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Customer not found.' });
    }

    const customer = customers[0];

    // Fetch customer's appraisals and loans
    const [{ rows: appraisals }, { rows: loans }] = await Promise.all([
      query('SELECT * FROM appraisals WHERE customer_id = $1 ORDER BY created_at DESC', [id]),
      query('SELECT * FROM loans WHERE customer_id = $1 ORDER BY created_at DESC', [id]),
    ]);

    return res.status(200).json({
      customer,
      appraisals,
      loans,
    });
  } catch (err) {
    console.error('Get customer by ID error:', err);
    return res.status(500).json({ error: 'Server Error', message: 'Failed to retrieve customer details.' });
  }
}