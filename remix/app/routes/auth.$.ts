import {ComplicatedAuthServer, RedisReferenceStore} from "@complicatedauth/server";
import {createClient} from "redis";

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

const handle = async ({request}: {request: Request}) => {
  await ready;
  return auth.handle(request);
};

export const loader = handle;
export const action = handle;
