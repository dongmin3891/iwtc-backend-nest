export interface CommentListItem {
  commentId: number;
  commentWriterId: number | null;
  writerNickname: string;
  body: string;
  createdAt: Date;
}
