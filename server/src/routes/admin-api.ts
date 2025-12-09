export default [
  {
    method: "POST",
    path: "/deploy",
    handler: "controller.deploy",
    config: {
      policies: [],
    },
  },
  {
    method: "GET",
    path: "/deployments",
    handler: "controller.listDeployments",
    config: {
      policies: [],
    },
  },
];
