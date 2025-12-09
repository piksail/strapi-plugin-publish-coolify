import type { Core } from "@strapi/strapi";
import controller from "./controller";

const controllers: {
  controller: typeof controller;
} = {
  controller,
};

export default controllers;
