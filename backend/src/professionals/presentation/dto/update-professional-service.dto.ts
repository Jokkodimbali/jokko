import { PartialType } from '@nestjs/mapped-types';
import { CreateProfessionalServiceDto } from './create-professional-service.dto';

export class UpdateProfessionalServiceDto extends PartialType(
  CreateProfessionalServiceDto,
) {
  // Inherits all properties from CreateProfessionalServiceDto as optional
}

export { ServicePriceType } from './create-professional-service.dto';
