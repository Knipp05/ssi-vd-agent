"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@credo-ts/core");
const node_1 = require("@credo-ts/node");
const core_2 = require("@credo-ts/core");
const node_2 = require("@credo-ts/node");
const config = {
    label: 'docs-agent-nodejs',
    walletConfig: {
        id: 'wallet-id',
        key: 'testkey0000000000000000000000000',
    },
};
const agent = new core_1.Agent({
    config,
    dependencies: node_1.agentDependencies,
});
agent.registerOutboundTransport(new core_2.HttpOutboundTransport());
agent.registerOutboundTransport(new core_2.WsOutboundTransport());
agent.registerInboundTransport(new node_2.HttpInboundTransport({ port: 3000 }));
agent
    .initialize()
    .then(() => {
    console.log('Agent initialized!');
})
    .catch((e) => {
    console.error(`Something went wrong while setting up the agent! Message: ${e}`);
});
