import { validateFreeDeployment } from "../src/server/config/free-deployment.ts";
try {
  console.log(JSON.stringify(validateFreeDeployment(process.env)));
} catch (error) {
  // ConfigurationError messages name fields only; never print raw values/errors.
  console.error(error?.name === "ConfigurationError" ? error.message : "Deployment configuration could not be validated.");
  process.exitCode = 1;
}
