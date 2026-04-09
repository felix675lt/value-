/**
 * Phase 1 MVP 스키마 — 시니어 전문가 스팟 매칭 플랫폼
 */
exports.up = async function (knex) {
  // ── users ──
  await knex.schema.createTable('users', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.string('email').notNullable().unique();
    t.string('phone', 20);
    t.string('password_hash').notNullable();
    t.enum('role', ['expert', 'client', 'admin']).notNullable();
    t.timestamps(true, true);
  });

  // ── expert_profiles ──
  await knex.schema.createTable('expert_profiles', (t) => {
    t.uuid('user_id').primary().references('id').inTable('users').onDelete('CASCADE');
    t.string('name').notNullable();
    t.string('photo_url');
    t.string('video_url');
    t.integer('min_daily_rate');
    t.integer('max_daily_rate');
    t.boolean('accept_incentive').defaultTo(false);
    t.boolean('available_remote').defaultTo(true);
    t.specificType('regions', 'text[]');
    t.enum('verified_level', ['basic', 'premium']).defaultTo('basic');
    t.decimal('rating_avg', 3, 2).defaultTo(0);
    t.integer('project_count').defaultTo(0);
    t.timestamps(true, true);
  });

  // ── expert_careers ──
  await knex.schema.createTable('expert_careers', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.uuid('expert_id').notNullable().references('user_id').inTable('expert_profiles').onDelete('CASCADE');
    t.string('company_name').notNullable();
    t.string('industry');
    t.string('position');
    t.integer('start_year');
    t.integer('end_year');
    t.text('description');
    t.timestamps(true, true);
  });

  // ── expert_tags ──
  await knex.schema.createTable('expert_tags', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.uuid('expert_id').notNullable().references('user_id').inTable('expert_profiles').onDelete('CASCADE');
    t.string('tag_name').notNullable();
    t.enum('tag_type', ['network', 'skill', 'industry']).defaultTo('skill');
    t.timestamps(true, true);
  });

  // ── projects ──
  await knex.schema.createTable('projects', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.uuid('client_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('title').notNullable();
    t.enum('category', [
      'sales', 'marketing', 'production', 'rnd',
      'finance', 'hr', 'overseas', 'other',
    ]).notNullable();
    t.text('description');
    t.text('required_background');
    t.integer('duration_days').notNullable();
    t.integer('budget_min').notNullable();
    t.integer('budget_max').notNullable();
    t.boolean('has_incentive').defaultTo(false);
    t.text('incentive_condition');
    t.integer('incentive_amount');
    t.enum('work_type', ['onsite', 'remote', 'hybrid']).defaultTo('remote');
    t.string('region');
    t.enum('status', ['open', 'matched', 'ongoing', 'completed', 'cancelled']).defaultTo('open');
    t.timestamps(true, true);
  });

  // ── proposals ──
  await knex.schema.createTable('proposals', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.uuid('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE');
    t.uuid('expert_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.integer('proposed_daily_rate').notNullable();
    t.text('proposed_incentive_condition');
    t.string('cover_message', 500);
    t.text('expected_deliverable');
    t.enum('status', ['pending', 'accepted', 'rejected']).defaultTo('pending');
    t.timestamps(true, true);
    t.unique(['project_id', 'expert_id']);
  });

  // ── contracts ──
  await knex.schema.createTable('contracts', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.uuid('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE');
    t.uuid('expert_id').notNullable().references('id').inTable('users');
    t.uuid('client_id').notNullable().references('id').inTable('users');
    t.integer('daily_rate').notNullable();
    t.integer('total_amount').notNullable();
    t.date('start_date').notNullable();
    t.date('end_date').notNullable();
    t.text('incentive_condition');
    t.integer('incentive_amount');
    t.string('contract_url');
    t.enum('status', ['pending_escrow', 'active', 'completed', 'disputed', 'cancelled']).defaultTo('pending_escrow');
    t.timestamps(true, true);
  });

  // ── escrows ──
  await knex.schema.createTable('escrows', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.uuid('contract_id').notNullable().unique().references('id').inTable('contracts').onDelete('CASCADE');
    t.bigInteger('total_deposited').defaultTo(0);
    t.bigInteger('total_released').defaultTo(0);
    t.enum('status', ['pending', 'holding', 'partial', 'released']).defaultTo('pending');
    t.string('payment_key'); // 토스페이먼츠 paymentKey
    t.timestamps(true, true);
  });

  // ── daily_completions ──
  await knex.schema.createTable('daily_completions', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.uuid('contract_id').notNullable().references('id').inTable('contracts').onDelete('CASCADE');
    t.date('work_date').notNullable();
    t.timestamp('expert_checked_at');
    t.timestamp('client_confirmed_at');
    t.enum('payment_status', ['pending', 'paid', 'disputed']).defaultTo('pending');
    t.timestamp('paid_at');
    t.timestamps(true, true);
    t.unique(['contract_id', 'work_date']);
  });

  // ── reviews ──
  await knex.schema.createTable('reviews', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.uuid('contract_id').notNullable().references('id').inTable('contracts').onDelete('CASCADE');
    t.uuid('reviewer_id').notNullable().references('id').inTable('users');
    t.uuid('reviewee_id').notNullable().references('id').inTable('users');
    t.integer('rating').notNullable();
    t.text('comment');
    t.timestamps(true, true);
    t.unique(['contract_id', 'reviewer_id']);
  });

  // ── payments ──
  await knex.schema.createTable('payments', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.uuid('contract_id').notNullable().references('id').inTable('contracts');
    t.bigInteger('amount').notNullable();
    t.enum('type', ['daily', 'incentive', 'platform_fee', 'withholding_tax']).notNullable();
    t.enum('direction', ['in', 'out']).notNullable();
    t.enum('status', ['pending', 'completed', 'failed']).defaultTo('pending');
    t.jsonb('metadata'); // 토스페이먼츠 응답 등
    t.timestamps(true, true);
  });

  // ── messages ──
  await knex.schema.createTable('messages', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.uuid('sender_id').notNullable().references('id').inTable('users');
    t.uuid('receiver_id').notNullable().references('id').inTable('users');
    t.uuid('project_id').references('id').inTable('projects');
    t.text('content').notNullable();
    t.boolean('is_read').defaultTo(false);
    t.timestamps(true, true);
  });

  // indexes
  await knex.schema.raw('CREATE INDEX idx_projects_status ON projects(status)');
  await knex.schema.raw('CREATE INDEX idx_projects_category ON projects(category)');
  await knex.schema.raw('CREATE INDEX idx_proposals_project ON proposals(project_id)');
  await knex.schema.raw('CREATE INDEX idx_messages_receiver ON messages(receiver_id, is_read)');
};

exports.down = async function (knex) {
  const tables = [
    'messages', 'payments', 'reviews', 'daily_completions',
    'escrows', 'contracts', 'proposals', 'projects',
    'expert_tags', 'expert_careers', 'expert_profiles', 'users',
  ];
  for (const table of tables) {
    await knex.schema.dropTableIfExists(table);
  }
};
