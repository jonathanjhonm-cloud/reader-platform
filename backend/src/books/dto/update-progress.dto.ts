import { IsNumber, IsString, Max, Min } from 'class-validator';

export class UpdateProgressDto {
  @IsString()
  location!: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  percentage!: number;
}
