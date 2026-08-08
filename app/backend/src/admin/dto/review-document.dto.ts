import { IsEnum, IsNotEmpty } from 'class-validator';
import { DocumentStatus } from '@prisma/client';

export class ReviewDocumentDto {
  @IsNotEmpty({ message: 'Document review status is required (approved or rejected)' })
  @IsEnum(DocumentStatus, { message: 'Status must be approved or rejected' })
  status: DocumentStatus;
}
