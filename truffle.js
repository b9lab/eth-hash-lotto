const Ganache = require("ganache-cli");
const ganacheProvider = Ganache.provider();

module.exports = {
    networks: {
        development: {
            provider: () => ganacheProvider,
            network_id: "*" // match any network
        }
    }
};
