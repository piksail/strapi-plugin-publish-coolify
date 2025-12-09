import type { Core } from "@strapi/strapi";
import service from "./service";

const services: {
  service: typeof service;
} = {
  service,
};

export default services;
