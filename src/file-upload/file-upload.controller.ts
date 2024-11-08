import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  UseGuards,
} from '@nestjs/common';
import { FileUploadService } from './file-upload.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { Roles } from 'src/auth/decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles/roles.guard';

@Controller('file-upload')
export class FileUploadController {
  constructor(private readonly fileUploadService: FileUploadService) {}

  @Roles(Role.USER)
  @UseGuards(RolesGuard)
  @UseGuards(JwtAuthGuard)
  @Post('')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        //TODO allow only docx and pdf files
        validators: [
          // new MaxFileSizeValidator({ maxSize: 1000 }),
          // new FileTypeValidator({ fileType: 'image/jpeg' }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.fileUploadService.create(file);
  }
}
