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
];
