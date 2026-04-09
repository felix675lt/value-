const bcrypt = require('bcryptjs');

exports.seed = async function (knex) {
  // Clean tables in order
  await knex('messages').del();
  await knex('payments').del();
  await knex('reviews').del();
  await knex('daily_completions').del();
  await knex('escrows').del();
  await knex('contracts').del();
  await knex('proposals').del();
  await knex('projects').del();
  await knex('expert_tags').del();
  await knex('expert_careers').del();
  await knex('expert_profiles').del();
  await knex('users').del();

  const hash = await bcrypt.hash('password123', 12);

  // Users
  const [client] = await knex('users').insert({
    email: 'client@example.com',
    phone: '010-1234-5678',
    password_hash: hash,
    role: 'client',
  }).returning('*');

  const [expert] = await knex('users').insert({
    email: 'expert@example.com',
    phone: '010-9876-5432',
    password_hash: hash,
    role: 'expert',
  }).returning('*');

  // Expert profile
  await knex('expert_profiles').insert({
    user_id: expert.id,
    name: '김전문',
    min_daily_rate: 500000,
    max_daily_rate: 1000000,
    accept_incentive: true,
    available_remote: true,
    regions: ['서울', '대구', '부산'],
  });

  await knex('expert_careers').insert([
    {
      expert_id: expert.id,
      company_name: '삼성전자',
      industry: '반도체',
      position: '부장',
      start_year: 2005,
      end_year: 2020,
      description: '반도체 사업부 영업 총괄',
    },
    {
      expert_id: expert.id,
      company_name: 'LG화학',
      industry: '화학',
      position: '팀장',
      start_year: 2000,
      end_year: 2005,
      description: '해외영업팀 동남아 담당',
    },
  ]);

  await knex('expert_tags').insert([
    { expert_id: expert.id, tag_name: '삼성전자벤더', tag_type: 'network' },
    { expert_id: expert.id, tag_name: '반도체영업', tag_type: 'skill' },
    { expert_id: expert.id, tag_name: '베트남법인경험', tag_type: 'network' },
  ]);

  // Sample project
  await knex('projects').insert({
    client_id: client.id,
    title: '베트남 시장 진출 자문 (반도체 부품)',
    category: 'overseas',
    description: '베트남 현지 반도체 부품 유통망 확보를 위한 전문가 자문이 필요합니다.',
    required_background: '반도체 업계 경력 15년 이상, 동남아 시장 경험자',
    duration_days: 5,
    budget_min: 500000,
    budget_max: 800000,
    has_incentive: true,
    incentive_condition: '현지 유통 계약 체결 시',
    incentive_amount: 3000000,
    work_type: 'hybrid',
    region: '서울',
  });

  console.log('✅ Seed data inserted');
};
