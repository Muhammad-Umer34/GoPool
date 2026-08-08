import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { RatingsService } from './ratings.service';
import { CreateRatingDto } from './dto/create-rating.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.type';

@Controller('ratings')
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createRating(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateRatingDto,
  ) {
    return this.ratingsService.createRating(user.sub, dto);
  }

  @Get('user/:userId')
  @Public()
  async getUserRatings(@Param('userId') userId: string) {
    return this.ratingsService.getUserRatings(userId);
  }
}
