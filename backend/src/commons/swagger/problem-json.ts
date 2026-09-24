import { getSchemaPath } from '@nestjs/swagger';
import { ProblemDetailsDto } from './problem-details.dto';

export const PROBLEM_JSON = {
  'application/problem+json': {
    schema: { $ref: getSchemaPath(ProblemDetailsDto) },
  },
};