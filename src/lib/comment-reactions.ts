/** Emojis para reaccionar a un comentario (mismos que admite la base de datos, migración 011). */
export const COMMENT_EMOJIS = ["👍", "❤️", "😂", "😮", "🔥", "💪"] as const;

export type CommentReaction = { user_id: string; emoji: string; name: string };
