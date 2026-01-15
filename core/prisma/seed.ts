import { PrismaClient } from "../src/generated/prisma/client";
import { UserRoleEnum, SubmissionTypeEnum } from "../src/generated/prisma/enums";
import { faker } from "@faker-js/faker";
import * as argon2 from "argon2";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log("Emptying database...");
    await prisma.unlockedStages.deleteMany();
    await prisma.unlockedModules.deleteMany();
    await prisma.submissions.deleteMany();
    await prisma.courseEnrollments.deleteMany();
    await prisma.tests.deleteMany();
    await prisma.stage.deleteMany();
    await prisma.module.deleteMany();
    await prisma.course.deleteMany();
    await prisma.userOnboarding.deleteMany();
    await prisma.user.deleteMany();

    console.log("Seeding data...");

    const hashedPassword = await argon2.hash("password123");

    // 1. Create Admins
    console.log("Creating Admins...");
    await prisma.user.createMany({
        data: [
            {
                name: "System Admin",
                email: "admin@questrider.com",
                password: hashedPassword,
                phoneNumber: "1111111111",
                role: UserRoleEnum.ADMIN,
            },
            {
                name: "Root Admin",
                email: "root@questrider.com",
                password: hashedPassword,
                phoneNumber: "2222222222",
                role: UserRoleEnum.ADMIN,
            }
        ]
    });

    // 2. Create Educators
    console.log("Creating Educators...");
    const educators = await Promise.all(
        Array.from({ length: 3 }).map((_, i) =>
            prisma.user.create({
                data: {
                    name: i === 0 ? "Dr. Jane Smith" : faker.person.fullName(),
                    email: i === 0 ? "educator@questrider.com" : faker.internet.email(),
                    password: hashedPassword,
                    phoneNumber: faker.phone.number(),
                    role: UserRoleEnum.EDUCATOR,
                    bio: faker.lorem.paragraphs(2),
                    profileImageUrl: faker.image.avatar(),
                },
            })
        )
    );

    // 3. Create Students
    console.log("Creating Students...");
    const students = await Promise.all(
        Array.from({ length: 15 }).map((_, i) =>
            prisma.user.create({
                data: {
                    name: faker.person.fullName(),
                    email: i === 0 ? "student@questrider.com" : faker.internet.email(),
                    password: hashedPassword,
                    phoneNumber: faker.phone.number(),
                    role: UserRoleEnum.STUDENT,
                    profileImageUrl: faker.image.avatar(),
                },
            })
        )
    );

    // 4. Create Onboarding (Pending)
    console.log("Creating Onboarding records...");
    await Promise.all(
        Array.from({ length: 5 }).map(() =>
            prisma.userOnboarding.create({
                data: {
                    name: faker.person.fullName(),
                    email: faker.internet.email(),
                    password: hashedPassword,
                    phoneNumber: faker.phone.number(),
                    otp: faker.string.numeric(6),
                    expiryAt: new Date(Date.now() + 10 * 60 * 1000),
                },
            })
        )
    );

    // 5. Create Courses
    console.log("Creating Courses, Modules, and Stages...");
    const courseTitles = [
        "Mastering TypeScript",
        "React for Professionals",
        "Advanced Node.js Patterns",
        "Introduction to PostgreSQL",
        "Prisma ORM Deep Dive",
        "Testing with Vitest",
        "Building CLI Tools in Bun",
        "Clean Code in JavaScript",
        "DevOps for Frontend Devs",
        "System Design 101"
    ];

    const courses = [];
    for (const title of courseTitles) {
        const educator = faker.helpers.arrayElement(educators);
        const course = await prisma.course.create({
            data: {
                title,
                description: faker.lorem.paragraphs(2),
                educatorId: educator.id,
                isPublished: true,
                logoUrl: faker.image.url({ width: 200, height: 200 }),
                rating: faker.number.float({ min: 4.0, max: 5.0, fractionDigits: 1 }),
                updatedAt: faker.date.past(),
            },
        });
        courses.push(course);

        // Modules
        let prevModuleId: string | null = null;
        const moduleCount = faker.number.int({ min: 4, max: 6 });

        for (let m = 0; m < moduleCount; m++) {
            const newModule: any = await prisma.module.create({
                data: {
                    title: `Module ${m + 1}: ${faker.commerce.productName()}`,
                    description: faker.lorem.sentence(),
                    courseId: course.id,
                    isPublished: true,
                    prevModuleId: prevModuleId,
                },
            });
            prevModuleId = newModule.id;

            // Stages
            let prevStageId: string | null = null;
            const stageCount = faker.number.int({ min: 3, max: 5 });

            for (let s = 0; s < stageCount; s++) {
                const newStage: any = await prisma.stage.create({
                    data: {
                        title: `Stage ${s + 1}: ${faker.hacker.verb()} ${faker.hacker.noun()}`,
                        description: faker.lorem.sentence(),
                        moduleId: newModule.id,
                        prevStageId: prevStageId,
                    },
                });
                prevStageId = newStage.id;

                // Tests
                await prisma.tests.createMany({
                    data: [
                        {
                            name: "Unit Test",
                            orderIdx: 0,
                            script: "expect(true).toBe(true);",
                            stageId: newStage.id,
                            submitOnly: false,
                        },
                        {
                            name: "Submission Check",
                            orderIdx: 1,
                            script: "expect(result).toBeDefined();",
                            stageId: newStage.id,
                            submitOnly: true,
                        }
                    ]
                });
            }
        }
    }

    // 6. Create Enrollments and Varied Progress
    console.log("Generating Enrollments and Progress...");
    for (const student of students) {
        // Each student enrolls in 1 to 3 random courses
        const coursesToEnroll = faker.helpers.arrayElements(courses, { min: 1, max: 3 });

        for (const course of coursesToEnroll) {
            await prisma.courseEnrollments.create({
                data: {
                    userId: student.id,
                    courseId: course.id,
                    enrolledAt: faker.date.past(),
                },
            });

            // Decide progress level: 0%, 25%, 50%, 75%, or 100%
            const progress = faker.helpers.arrayElement([0, 0.25, 0.5, 0.75, 1]);
            
            if (progress > 0) {
                const modules = await prisma.module.findMany({
                    where: { courseId: course.id },
                    include: { Stages: { orderBy: { createdAt: "asc" } } },
                    orderBy: { createdAt: "asc" },
                });

                // Flatten all stages to calculate how many to complete
                const allStages = modules.flatMap(m => m.Stages);
                const stagesToCompleteCount = Math.floor(allStages.length * progress);
                const stagesToComplete = allStages.slice(0, stagesToCompleteCount);

                for (const stage of stagesToComplete) {
                    await prisma.submissions.create({
                        data: {
                            userId: student.id,
                            stageId: stage.id,
                            hasPassed: true,
                            exitCode: 0,
                            stdout: faker.lorem.word(),
                            stderr: "",
                            cliVersion: "1.0.0",
                            submissionType: SubmissionTypeEnum.SUBMIT,
                            submittedAt: faker.date.recent(),
                        },
                    });

                    await prisma.unlockedStages.create({
                        data: {
                            userId: student.id,
                            stageId: stage.id,
                        },
                    });
                }

                // Unlock modules based on completed stages
                const completedModuleIds = new Set(stagesToComplete.map(s => s.moduleId));
                for (const moduleId of completedModuleIds) {
                    await prisma.unlockedModules.create({
                        data: {
                            userId: student.id,
                            moduleId: moduleId,
                        },
                    });
                }
            }
        }
    }

    console.log("Seeding complete! 🚀");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });