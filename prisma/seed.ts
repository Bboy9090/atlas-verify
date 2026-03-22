import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create demo user
  const password = await hash('demo1234', 12)
  const user = await prisma.user.upsert({
    where: { email: 'demo@atlasverify.app' },
    update: {},
    create: {
      email: 'demo@atlasverify.app',
      name: 'Demo User',
      password,
    },
  })
  console.log(`✅ User: ${user.email}`)

  // Create demo cases
  const case1 = await prisma.case.upsert({
    where: { id: 'seed-case-001' },
    update: {},
    create: {
      id: 'seed-case-001',
      title: 'Background Check – John Smith',
      description: 'Pre-employment background verification for senior analyst role',
      status: 'in-progress',
      userId: user.id,
    },
  })

  const case2 = await prisma.case.upsert({
    where: { id: 'seed-case-002' },
    update: {},
    create: {
      id: 'seed-case-002',
      title: 'Fraud Investigation – Acme Corp',
      description: 'Investigating suspected wire fraud related to Q3 transactions',
      status: 'open',
      userId: user.id,
    },
  })

  const case3 = await prisma.case.upsert({
    where: { id: 'seed-case-003' },
    update: {},
    create: {
      id: 'seed-case-003',
      title: 'Compliance Review – Jane Doe',
      description: 'Annual compliance check for licensed financial advisor',
      status: 'closed',
      userId: user.id,
    },
  })
  console.log(`✅ Cases: ${case1.title}, ${case2.title}, ${case3.title}`)

  // Create demo subjects
  const subject1 = await prisma.subject.upsert({
    where: { id: 'seed-subject-001' },
    update: {},
    create: {
      id: 'seed-subject-001',
      fullName: 'John Smith',
      phoneE164: '+14155550101',
      email: 'jsmith@example.com',
      address: '100 Market St',
      city: 'San Francisco',
      state: 'CA',
      notes: 'Candidate for senior analyst position. References pending.',
      caseId: case1.id,
    },
  })

  const subject2 = await prisma.subject.upsert({
    where: { id: 'seed-subject-002' },
    update: {},
    create: {
      id: 'seed-subject-002',
      fullName: 'Robert Johnson',
      phoneE164: '+12125550202',
      email: 'rjohnson@acme-corp.example',
      address: '200 Wall St',
      city: 'New York',
      state: 'NY',
      notes: 'CFO of Acme Corp. Flagged for unusual wire transfers.',
      caseId: case2.id,
    },
  })

  const subject3 = await prisma.subject.upsert({
    where: { id: 'seed-subject-003' },
    update: {},
    create: {
      id: 'seed-subject-003',
      fullName: 'Jane Doe',
      phoneE164: '+13125550303',
      email: 'janedoe@finadvise.example',
      address: '300 Michigan Ave',
      city: 'Chicago',
      state: 'IL',
      notes: 'Licensed financial advisor – license #FA-88421.',
      caseId: case3.id,
    },
  })
  console.log(`✅ Subjects: ${subject1.fullName}, ${subject2.fullName}, ${subject3.fullName}`)

  // Create demo audit log entries
  await prisma.auditLog.createMany({
    skipDuplicates: true,
    data: [
      {
        id: 'seed-audit-001',
        userId: user.id,
        action: 'CREATE_CASE',
        metadata: { caseId: case1.id, title: case1.title },
      },
      {
        id: 'seed-audit-002',
        userId: user.id,
        action: 'CREATE_SUBJECT',
        subjectId: subject1.id,
        metadata: { caseId: case1.id, subjectName: subject1.fullName },
      },
      {
        id: 'seed-audit-003',
        userId: user.id,
        action: 'CREATE_CASE',
        metadata: { caseId: case2.id, title: case2.title },
      },
    ],
  })
  console.log('✅ Audit logs created')

  console.log('\n🎉 Seed complete!')
  console.log('   Demo login: demo@atlasverify.app / demo1234')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
