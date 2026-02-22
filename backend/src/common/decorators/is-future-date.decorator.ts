import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

export function IsFutureDate(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string): void => {
    registerDecorator({
      name: 'isFutureDate',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
            return false;
          }

          return value.getTime() > Date.now();
        },
        defaultMessage(args: ValidationArguments): string {
          return `O campo ${args.property} deve ser uma data futura.`;
        },
      },
    });
  };
}
