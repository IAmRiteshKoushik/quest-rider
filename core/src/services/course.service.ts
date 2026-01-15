import { prisma } from "../db";
import { NotFoundError } from "../utils/errors";
import { sortSequence } from "../utils/sequence";

const formatMonthYear = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        year: "numeric",
    }).format(date);
};

export async function getAllPublishedCourses() {
    const courses = await prisma.course.findMany({
        where: { isPublished: true },
        include: {
            educator: {
                select: { name: true },
            },
            _count: {
                select: {
                    Module: true,
                    CourseEnrollments: true,
                },
            },
            Module: {
                where: { isPublished: true },
                select: {
                    id: true,
                    prevModuleId: true,
                    _count: {
                        select: { Stages: true },
                    },
                },
            },
        },
    });

    return courses.map((course) => {
        const sortedModules = sortSequence(
            course.Module.map((m) => ({ ...m, prevId: m.prevModuleId }))
        );

        const totalStages = sortedModules.reduce(
            (acc, mod) => acc + mod._count.Stages,
            0
        );

        return {
            courseId: course.id,
            courseTitle: course.title,
            logoUrl: course.logoUrl,
            rating: course.rating,
            educatorName: course.educator.name,
            totalModules: course._count.Module,
            totalStages,
            noOfEnrollments: course._count.CourseEnrollments,
            updatedAt: formatMonthYear(course.updatedAt),
        };
    });
}

export async function getCourseById(courseId: string) {
    const course = await prisma.course.findFirst({
        where: { id: courseId, isPublished: true },
        include: {
            educator: {
                select: { name: true, bio: true },
            },
            _count: {
                select: {
                    Module: true,
                    CourseEnrollments: true,
                },
            },
            Module: {
                where: { isPublished: true },
                include: {
                    Stages: {
                        orderBy: { createdAt: "asc" },
                    },
                    _count: {
                        select: { Stages: true },
                    },
                },
            },
        },
    });

    if (!course) {
        throw new NotFoundError("Course not found");
    }

    const sortedModules = sortSequence(
        course.Module.map((m) => ({ ...m, prevId: m.prevModuleId }))
    );

    const totalStages = sortedModules.reduce(
        (acc, mod) => acc + mod._count.Stages,
        0
    );

    return {
        courseId: course.id,
        courseTitle: course.title,
        courseDescription: course.description,
        logoUrl: course.logoUrl,
        rating: course.rating,
        educatorName: course.educator.name,
        educatorBio: course.educator.bio,
        totalModules: course._count.Module,
        totalStages,
        noOfEnrollments: course._count.CourseEnrollments,
        updatedAt: formatMonthYear(course.updatedAt),
        modules: sortedModules.map((mod) => ({
            modulesId: mod.id,
            moduleTitle: mod.title,
            moduleDescription: mod.description,
        })),
    };
}

export async function getAllCoursesAndEnrolled(userId: string) {
    // 1. Fetch all published courses
    const courses = await prisma.course.findMany({
        where: { isPublished: true },
        include: {
            educator: {
                select: { name: true },
            },
            _count: {
                select: {
                    Module: true,
                    CourseEnrollments: true,
                },
            },
            Module: {
                where: { isPublished: true },
                include: {
                    Stages: true,
                    _count: {
                        select: { Stages: true },
                    },
                },
            },
            CourseEnrollments: {
                where: { userId },
            },
        },
    });

    // 2. Fetch all passed submissions for progress
    const passedSubmissions = await prisma.submissions.findMany({
        where: { userId, hasPassed: true },
        select: { stageId: true },
    });

    const passedStageIds = new Set(passedSubmissions.map((s) => s.stageId));

    return courses.map((course) => {
        const isEnrolled = course.CourseEnrollments.length > 0;

        const sortedModules = sortSequence(
            course.Module.map((m) => ({ ...m, prevId: m.prevModuleId }))
        );

        const allSortedStages = sortedModules.flatMap((m) =>
            sortSequence(m.Stages.map((s) => ({ ...s, prevId: s.prevStageId })))
        );

        const totalStages = allSortedStages.length;
        
        let completedStages = 0;
        let currentStageId: string | null = null;

        if (isEnrolled) {
            completedStages = allSortedStages.filter((s) =>
                passedStageIds.has(s.id)
            ).length;

            const nextStage = allSortedStages.find(
                (s) => !passedStageIds.has(s.id)
            );
            currentStageId = nextStage ? nextStage.id : (allSortedStages[allSortedStages.length - 1]?.id || null);
        }

        return {
            courseId: course.id,
            courseTitle: course.title,
            logoUrl: course.logoUrl,
            rating: course.rating,
            educatorName: course.educator.name,
            isEnrolled,
            totalModules: course._count.Module,
            totalStages,
            completedStages: isEnrolled ? completedStages : undefined,
            currentStageId: isEnrolled ? currentStageId : undefined,
            noOfEnrollments: course._count.CourseEnrollments,
            updatedAt: formatMonthYear(course.updatedAt),
        };
    });
}
