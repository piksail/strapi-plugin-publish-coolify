export default [
  {
    method: 'POST',
    path: '/deploy',
    handler: 'controller.deploy',
    config: {
      policies: [],
      auth: false,
    },
  },
  {
    method: 'GET',
    path: '/deployments',
    handler: 'controller.listDeployments',
    config: {
      policies: [],
      auth: false,
    },
  },
];
