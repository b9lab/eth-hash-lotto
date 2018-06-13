const Promise = require("bluebird");
const HashLotto = artifacts.require("./HashLotto.sol");
const expectedExceptionPromise = require("../utils/expectedExceptionPromise.js");
const addEvmFunctions = require("../utils/evmFunctions.js");

contract('HashLotto', function(accounts) {
    
    addEvmFunctions(web3);
    Promise.promisifyAll(web3.eth, { suffix: "Promise" });
    Promise.promisifyAll(web3.version, { suffix: "Promise" });
    Promise.promisifyAll(web3.evm, { suffix: "Promise" });

    const maxGas = 3000000;
    let isTestRPC, hashLotto;

    const mineMany = function(times) {
        if (times <= 0) {
            return Promise.resolve();
        }
        return web3.evm.minePromise()
            .then(() => mineMany(times - 1));
    };

    before("should identify TestRPC", function() {
        return web3.version.getNodePromise()
            .then(node => isTestRPC = node.indexOf("EthereumJS TestRPC") >= 0);
    });

    beforeEach("should deploy a new hashLotto", function() {
        return HashLotto.new({ from: accounts[0], value: web3.toWei(0.1) })
            .then(created => hashLotto = created);
    });

    it("should not be possible to markMyWord if not enough Weis", function() {
        return expectedExceptionPromise(
            () => hashLotto.markMyWord("hello world", 1, { from: accounts[0], gas: maxGas,
                value: web3.toWei(web3.toBigNumber(0.1)).minus(1) }),
            maxGas);
    });

    it("should not be possible to markMyWord if ahead is 0", function() {
        return expectedExceptionPromise(
            () => hashLotto.markMyWord("hello world", 0, { from: accounts[0], gas: maxGas,
                value: web3.toWei(0.1) }),
            maxGas);
    });

    describe("markMyWord", function() {

        let blockMarked;

        beforeEach("should markMyWord", function() {
            return hashLotto.markMyWord("hello world", 1, { from: accounts[0], value: web3.toWei(0.1) })
                .then(txObj => blockMarked = txObj.receipt.blockNumber);
        });

        it("should have kept the balance", function() {
            return web3.eth.getBalancePromise(hashLotto.address)
                .then(balance => assert.strictEqual(balance.toString(10), web3.toWei("0.2")));
        });

        it("should have saved the Ticket", function() {
            return hashLotto.tickets(accounts[0])
                .then(ticket => {
                    assert.strictEqual(web3.toUtf8(ticket[0]), "hello world");
                    assert.strictEqual(ticket[1].toNumber(), blockMarked + 1);
                });
        });

        it("should overwrite saved Ticket", function() {
            return hashLotto.markMyWord("not my world", 2, { from: accounts[0], value: web3.toWei(0.1) })
                .then(txObj => blockMarked = txObj.receipt.blockNumber)
                .then(() => hashLotto.tickets(accounts[0]))
                .then(ticket => {
                    assert.strictEqual(web3.toUtf8(ticket[0]), "not my world");
                    assert.strictEqual(ticket[1].toNumber(), blockMarked + 2);
                });
        });

    });

    it("should not be possible to toldYouSo before the block number is big enough", function() {
        return expectedExceptionPromise(
            () => hashLotto.toldYouSo("brag", { from: accounts[0], gas: maxGas }),
            maxGas);
    });

    it("should not be possible to toldYouSo after 256 blocks without markMyWord first", function() {
        if (!isTestRPC) this.skip("Needs TestRPC");
        return web3.eth.getBlockPromise("latest")
            .then(block => {
                if (block.number <= 256) {
                    return mineMany(256 - block.number);
                }
            })
            .then(() => expectedExceptionPromise(
                () => hashLotto.toldYouSo("brag", { from: accounts[0], gas: maxGas }),
                maxGas));
    });

    it("should not be possible to toldYouSo with hash 0 after 255 blocks", function() {
        if (!isTestRPC) this.skip("Needs TestRPC");
        return hashLotto.markMyWord(0, 1, { from: accounts[0], value: web3.toWei(0.1) })
            .then(() => mineMany(256))
            .then(() => expectedExceptionPromise(
                () => hashLotto.toldYouSo("brag", { from: accounts[0], gas: maxGas }),
                maxGas));
    });

    it("should be possible to toldYouSo with hash 0 after 256 blocks", function() {
        if (!isTestRPC) this.skip("Needs TestRPC");
        return hashLotto.markMyWord(0, 1, { from: accounts[0], value: web3.toWei(0.1) })
            .then(() => mineMany(257))
            .then(() => hashLotto.toldYouSo("brag", { from: accounts[0] }))
            .then(txObj => {
                assert.strictEqual(txObj.logs.length, 1);
                const toldYouEvent = txObj.logs[0];
                assert.strictEqual(toldYouEvent.args.who, accounts[0]);
                assert.strictEqual(web3.toUtf8(toldYouEvent.args.braggingRights), "brag");
            })
            .then(() => hashLotto.tickets(accounts[0]))
            .then(ticket => {
                    assert.strictEqual(web3.toUtf8(ticket[0]), "");
                    assert.strictEqual(ticket[1].toNumber(), 0);                
            })
            .then(() => web3.eth.getBalancePromise(hashLotto.address))
            .then(balance => assert.strictEqual(balance.toString(10), "0"));
    });

});
