"use strict";

module.exports = function(web3) {
    web3.evm = web3.evm ? web3.evm : {};

    if (typeof web3.evm.snapshot === "undefined") {
        web3.evm.snapshot = () => new Promise((resolve, reject) => {
            web3.currentProvider.send(
                {
                    jsonrpc: "2.0",
                    method: "evm_snapshot",
                    params: [],
                    id: new Date().getTime()
                },
                (error, result) => error ? reject(error) : resolve(result.result));
        });
    }

    if (typeof web3.evm.revert === "undefined") {
        /**
         * @param {!number} snapshotId. The snapshot to revert.
         */
        web3.evm.revert = snapshotId => new Promise((resolve, reject) => {
            web3.currentProvider.send(
                {
                    jsonrpc: "2.0",
                    method: "evm_revert",
                    params: [ snapshotId ],
                    id: new Date().getTime()
                },
                (error, result) => error ? reject(error) : resolve(result.result));
        });
    }

    if (typeof web3.evm.increaseTime === "undefined") {
        /**
         * @param {!number} offset. Time in milliseconds by which to advance the EVM.
         */
        web3.evm.increaseTime = offset => new Promise((resolve, reject) => {
            web3.currentProvider.send(
                {
                    jsonrpc: "2.0",
                    method: "evm_increaseTime",
                    params: [ offset ],
                    id: new Date().getTime()
                },
                (error, result) => error ? reject(error) : resolve(result.result));
        });
    }

    if (typeof web3.evm.mine === "undefined") {
        web3.evm.mine = () => new Promise((resolve, reject) => {
            web3.currentProvider.send(
                {
                    jsonrpc: "2.0",
                    method: "evm_mine",
                    params: [],
                    id: new Date().getTime()
                },
                (error, result) => error ? reject(error) : resolve(result.result));
        });
    }
};