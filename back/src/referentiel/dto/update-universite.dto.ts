import { PartialType } from '@nestjs/swagger';
import { CreateUniversiteDto } from './create-universite.dto';

export class UpdateUniversiteDto extends PartialType(CreateUniversiteDto) {}
