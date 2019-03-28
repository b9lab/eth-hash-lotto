const HashLotto = artifacts.require("./HashLotto.sol");
const expectedExceptionPromise = require("../utils/expectedExceptionPromise.js");
const addEvmFunctions = require("../utils/evmFunctions.js");

contract('HashLotto', function(accounts) {
    
    assert.isAtLeast(accounts.length, 1);

    addEvmFunctions(web3);

    const maxGas = 3000000;
    let isTestRPC, hashLotto;

    const mineMany = function(times) {
        if (times <= 0) {
            return Promise.resolve();
        }
        return web3.evm.mine()
            .then(() => mineMany(times - 1));
    };

    before("should identify TestRPC", function() {
        return web3.eth.getNodeInfo()
            .then(node => isTestRPC = node.indexOf("EthereumJS TestRPC") >= 0);
    });

    beforeEach("should deploy a new hashLotto", function() {
        return HashLotto.new({ from: accounts[0], value: web3.utils.toWei("0.1") })
            .then(created => hashLotto = created);
    });

    it("should not be possible to markMyWord if not enough Weis", function() {
        return expectedExceptionPromise(
            () => hashLotto.markMyWord(web3.utils.utf8ToHex("hello world"), 1, { from: accounts[0], gas: maxGas,
                value: web3.utils.toBN(web3.utils.toWei("0.1")).sub(web3.utils.toBN(1)) }),
            maxGas);
    });

    it("should not be possible to markMyWord if ahead is 0", function() {
        return expectedExceptionPromise(
            () => hashLotto.markMyWord(web3.utils.utf8ToHex("hello world"), 0, { from: accounts[0], gas: maxGas,
                value: web3.utils.toWei("0.1") }),
            maxGas);
    });

    describe("markMyWord", function() {

        let blockMarked;

        beforeEach("should markMyWord", function() {
            return hashLotto.markMyWord(web3.utils.utf8ToHex("hello world"), 1, { from: accounts[0], value: web3.utils.toWei("0.1") })
                .then(txObj => blockMarked = txObj.receipt.blockNumber);
        });

        it("should have kept the balance", function() {
            return web3.eth.getBalance(hashLotto.address)
                .then(balance => assert.strictEqual(balance.toString(10), web3.utils.toWei("0.2")));
        });

        it("should have saved the Ticket", function() {
            return hashLotto.tickets(accounts[0])
                .then(ticket => {
                    assert.strictEqual(web3.utils.hexToUtf8(ticket[0]), "hello world");
                    assert.strictEqual(ticket[1].toNumber(), blockMarked + 1);
                });
        });

        it("should overwrite saved Ticket", function() {
            return hashLotto.markMyWord(web3.utils.utf8ToHex("not my world"), 2, { from: accounts[0], value: web3.utils.toWei("0.1") })
                .then(txObj => blockMarked = txObj.receipt.blockNumber)
                .then(() => hashLotto.tickets(accounts[0]))
                .then(ticket => {
                    assert.strictEqual(web3.utils.hexToUtf8(ticket[0]), "not my world");
                    assert.strictEqual(ticket[1].toNumber(), blockMarked + 2);
                });
        });

    });

    it("should not be possible to toldYouSo before the block number is big enough", function() {
        return expectedExceptionPromise(
            () => hashLotto.toldYouSo(web3.utils.utf8ToHex("brag"), { from: accounts[0], gas: maxGas }),
            maxGas);
    });

    it("should not be possible to toldYouSo after 256 blocks without markMyWord first", function() {
        if (!isTestRPC) this.skip("Needs TestRPC");
        return web3.eth.getBlock("latest")
            .then(block => {
                if (block.number <= 256) {
                    return mineMany(256 - block.number);
                }
            })
            .then(() => expectedExceptionPromise(
                () => hashLotto.toldYouSo(web3.utils.utf8ToHex("brag"), { from: accounts[0], gas: maxGas }),
                maxGas));
    });

    it("should not be possible to toldYouSo with hash 0 after 255 blocks", function() {
        if (!isTestRPC) this.skip("Needs TestRPC");
        return hashLotto.markMyWord("0x0", 1, { from: accounts[0], value: web3.utils.toWei("0.1") })
            .then(() => mineMany(256))
            .then(() => expectedExceptionPromise(
                () => hashLotto.toldYouSo(web3.utils.utf8ToHex("brag"), { from: accounts[0], gas: maxGas }),
                maxGas));
    });

    it("should be possible to toldYouSo with hash 0 after 256 blocks", function() {
        if (!isTestRPC) this.skip("Needs TestRPC");
        return hashLotto.markMyWord("0x0", 1, { from: accounts[0], value: web3.utils.toWei("0.1") })
            .then(() => mineMany(257))
            .then(() => hashLotto.toldYouSo(web3.utils.utf8ToHex("brag"), { from: accounts[0] }))
            .then(txObj => {
                assert.strictEqual(txObj.logs.length, 1);
                const toldYouEvent = txObj.logs[0];
                assert.strictEqual(toldYouEvent.args.who, accounts[0]);
                assert.strictEqual(web3.utils.hexToUtf8(toldYouEvent.args.braggingRights), "brag");
            })
            .then(() => hashLotto.tickets(accounts[0]))
            .then(ticket => {
                    assert.strictEqual(web3.utils.hexToUtf8(ticket[0]), "");
                    assert.strictEqual(ticket[1].toNumber(), 0);                
            })
            .then(() => web3.eth.getBalance(hashLotto.address))
            .then(balance => assert.strictEqual(balance.toString(10), "0"));
    });

});
