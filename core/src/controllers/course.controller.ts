import type { Request, Response } from "express";
import * as CourseService from "../services/course.service";
import { UnauthorizedError, BadRequestError } from "../utils/errors";

export const getAllCourses = async (req: Request, res: Response) => {
    const courses = await CourseService.getAllPublishedCourses();
    res.status(200).json({
        message: "Courses fetched",
        data: courses,
    });
};

export const getCourseById = async (req: Request, res: Response) => {
    const { courseId } = req.params;
    if (!courseId || typeof courseId !== "string") {
        throw new BadRequestError("Course ID is required");
    }
    const course = await CourseService.getCourseById(courseId);
    res.status(200).json({
        message: "Course fetched",
        data: course,
    });
};

export const getAllCoursesAndEnrolled = async (req: Request, res: Response) => {
    const userId = req.userId;

    if (!userId) {
        throw new UnauthorizedError("Unauthorized");
    }

    const courses = await CourseService.getAllCoursesAndEnrolled(userId);
    res.status(200).json({
        message: "Courses fetched",
        data: courses,
    });
};
