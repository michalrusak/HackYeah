import {
  Injectable,
  type PipeTransform,
  BadRequestException,
} from '@nestjs/common';

@Injectable()
export class ContactValidationPipe implements PipeTransform {
  constructor(private schema: { parse: (data: any) => any }) {}

  transform(value: unknown) {
    try {
      const parsedValue = this.schema.parse(value);
      return parsedValue;
    } catch (error: any) {
      throw new BadRequestException('Validation failed');
    }
  }
}
