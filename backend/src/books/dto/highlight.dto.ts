import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export const HIGHLIGHT_COLORS = ['yellow', 'green', 'blue', 'pink', 'purple'] as const;
export type HighlightColor = typeof HIGHLIGHT_COLORS[number];

export class CreateHighlightDto {
  @IsString()
  sectionId!: string;

  @IsInt()
  @Min(0)
  start!: number;

  @IsInt()
  @Min(1)
  end!: number;

  @IsIn(HIGHLIGHT_COLORS)
  color!: HighlightColor;

  @IsOptional()
  @IsString()
  @MaxLength(5_000)
  note?: string;
}

export class UpdateHighlightDto {
  @IsOptional()
  @IsIn(HIGHLIGHT_COLORS)
  color?: HighlightColor;

  @IsOptional()
  @IsString()
  @MaxLength(5_000)
  note?: string;
}
