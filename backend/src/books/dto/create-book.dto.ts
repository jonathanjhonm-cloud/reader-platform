import { IsIn, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class CreateBookDto {
  @IsString()
  @MaxLength(300)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  author?: string;

  @IsUrl({ require_tld: false })
  fileUrl!: string;

  @IsIn(['epub', 'pdf'])
  fileType!: 'epub' | 'pdf';

  @IsOptional()
  @IsUrl({ require_tld: false })
  coverUrl?: string;
}
