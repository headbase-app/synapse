import {z} from "zod";

export const PeerIdSchema = z.uuidv4()
export type PeerIdSchema = z.infer<typeof PeerIdSchema>

// todo: add relay id schema?

export const PeerSentMessageSchema = z.discriminatedUnion("kind", [
    z.object({kind: z.literal("ping")}),
    z.object({kind: z.literal("pong")}),
    z.object({kind: z.literal("peers.discover")}),
    z.object({
        kind: z.literal("message"),
        to: z.array(z.uuidv4()).optional(),
        data: z.string(),
        meta: z.string().optional(),
    }),
]);
export type PeerSentMessageSchema = z.infer<typeof PeerSentMessageSchema>

export const RelaySentMessageSchema = z.discriminatedUnion("kind", [
    z.object({kind: z.literal("ping")}),
    z.object({kind: z.literal("pong")}),
    z.object({
        kind: z.literal("peers.list"),
        peers: z.array(z.object({
            pid: z.uuidv4(),
            knownAs: z.string().optional(),
        })),
    }),
    z.object({
        kind: z.literal("message"),
        from: z.uuidv4(),
        to: z.array(z.uuidv4()).optional(),
        data: z.string(),
        meta: z.string().optional(),
    }),
]);
export type RelaySentMessageSchema = z.infer<typeof RelaySentMessageSchema>
