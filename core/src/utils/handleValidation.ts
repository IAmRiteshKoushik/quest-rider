import { type ZodType } from "zod";
import { ValidationError } from "./errors";

export function handleValidation<T>(
    schema: ZodType<T>,
    data: unknown
): T | never {
    const result = schema.safeParse(data);

    if (!result.success) {
        const errorJson: Record<string, string> = {};
        result.error.issues.forEach((issue) => {
            const field = issue.path.join(".");
            errorJson[field] = issue.message;
        });
        throw new ValidationError(errorJson);
    }

    return result.data;
}
