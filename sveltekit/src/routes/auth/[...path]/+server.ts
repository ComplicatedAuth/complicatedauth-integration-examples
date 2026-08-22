import {ComplicatedAuthServer, RedisReferenceStore} from "@complicatedauth/server";
import {createClient} from "redis";
import type {RequestHandler} from "./$types";

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const redis = createClient({url: required("REDIS_URL")});
const ready = redis.connect();
const auth = new ComplicatedAuthServer({
  backendUrl: required("COMPLICATEDAUTH_URL"),
  projectUid: required("COMPLICATEDAUTH_PROJECT_UID"),
  serviceCredential: required("COMPLICATEDAUTH_SERVICE_CREDENTIAL"),
  store: new RedisReferenceStore({client: redis, keyPrefix: "myapp:auth:"}),
});

const handle: RequestHandler = async ({request}) => {
  await ready;
  return auth.handle(request);
};

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
