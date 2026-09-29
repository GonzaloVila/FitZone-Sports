import { getSchemaPath } from '@nestjs/swagger';
import { Problem } from './problem.dto';

export const PROBLEM_JSON = {
  'application/problem+json': {
    schema: { $ref: getSchemaPath(Problem) },
  },
};