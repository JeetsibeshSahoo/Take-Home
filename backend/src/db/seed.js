import { query } from './index.js';

async function seed() {
  console.log('🌱 Seeding database with initial users and gold rate...');

  try {
    // 1. Seed users for each role (Admin, Branch Manager, Branch Staff)
    const users = [
      { email: 'admin@swarnsathi.com', full_name: 'Subhashish Sen (Admin)', role: 'ADMIN' },
      { email: 'manager@swarnsathi.com', full_name: 'Debolina Mukherjee (Branch Manager)', role: 'BRANCH_MANAGER' },
      { email: 'staff@swarnsathi.com', full_name: 'Rohan Ghosh (Branch Staff)', role: 'BRANCH_STAFF' },
      { email: 'staff2@swarnsathi.com', full_name: 'Priyanka Banerjee (Branch Staff 2)', role: 'BRANCH_STAFF' },
    ];

    for (const u of users) {
      await query(
        `INSERT INTO users (email, full_name, role, branch_name)
         VALUES ($1, $2, $3, 'Kolkata Main Branch')
         ON CONFLICT (email) DO NOTHING`,
        [u.email, u.full_name, u.role]
      );
    }
    console.log('✅ Seeded users for all roles.');

    // 2. Fetch admin user to attribute the initial gold rate
    const { rows: adminRows } = await query("SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1");
    const adminId = adminRows[0]?.id;

    // 3. Seed initial gold rate: ₹7,250 per gram (725,000 paise/gram for 24K)
    const today = new Date().toISOString().split('T')[0];
    await query(
      `INSERT INTO gold_rates (rate_per_gram_paise, effective_date, set_by_user_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (effective_date) DO NOTHING`,
      [725000, today, adminId]
    );
    console.log(`✅ Seeded starting gold rate for today (${today}): ₹7,250/g (725,000 paise).`);

    // 4. Seed a sample customer
    const { rows: staffRows } = await query("SELECT id FROM users WHERE role = 'BRANCH_STAFF' LIMIT 1");
    const staffId = staffRows[0]?.id;

    await query(
      `INSERT INTO customers (full_name, phone, date_of_birth, address, pan, aadhaar_last_4, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT DO NOTHING`,
      ['Amitava Roy', '9830012345', '1988-06-14', '74 Salt Lake Sector 1, Kolkata, WB', 'ABCDE1234F', '8912', staffId]
    );
    console.log('✅ Seeded sample customer: Amitava Roy.');

    console.log('🎉 Database seeding completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
    process.exit(1);
  }
}

seed();