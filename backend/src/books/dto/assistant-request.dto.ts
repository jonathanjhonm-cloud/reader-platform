import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class AssistantRequestDto {
  @IsIn(['summarize', 'explain', 'context', 'question'])
  action!: 'summarize' | 'explain' | 'context' | 'question';

  @IsOptional()
  @IsString()
  @MaxLength(12_000)
  selectedText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  question?: string;

  @IsOptional()
  @IsString()
  sectionId?: string;
}
