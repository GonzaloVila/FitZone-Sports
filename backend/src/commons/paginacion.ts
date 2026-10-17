import { ApiProperty } from '@nestjs/swagger';

export interface OpcionesPaginacion {
  page: number;
  perPage: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
}
