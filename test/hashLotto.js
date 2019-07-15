const HashLotto = artifacts.require("./HashLotto.sol");
const expectedExceptionPromise = require("../utils/expectedExceptionPromise.js");
const addEvmFunctions = require("../utils/evmFunctions.js");

const { hexToUtf8, toBN, toWei, utf8ToHex } = web3.utils;

contract('HashLotto', function(accounts) {
    
    assert.isAtLeast(accounts.length, 1);

    addEvmFunctions(web3);

    const maxGas = 3000000;
    let isTestRPC, hashLotto;

    const mineMany = async function(times) {
        if (times <= 0) {
            return;
        }
        await web3.evm.mine();
        await mineMany(times - 1);
    };

    before("should identify TestRPC", async function() {
        const node = await web3.eth.getNodeInfo();
        isTestRPC = node.indexOf("EthereumJS TestRPC") >= 0;
    });

    beforeEach("should deploy a new hashLotto", async function() {
        hashLotto = await HashLotto.new({ from: accounts[0], value: toWei("0.1") });
    });

    it("should not be possible to markMyWord if not enough Weis", function() {
        return expectedExceptionPromise(
            () => hashLotto.markMyWord(utf8ToHex("hello world"), 1, { from: accounts[0], gas: maxGas,
                value: toBN(toWei("0.1")).sub(toBN(1)) }),
            maxGas);
    });

    it("should not be possible to markMyWord if ahead is 0", function() {
        return expectedExceptionPromise(
            () => hashLotto.markMyWord(utf8ToHex("hello world"), 0, { from: accounts[0], gas: maxGas,
                value: toWei("0.1") }),
            maxGas);
    });

    describe("markMyWord", function() {

        let blockMarked;

        beforeEach("should markMyWord", async function() {
            blockMarked = (await hashLotto.markMyWord(utf8ToHex("hello world"), 1, { from: accounts[0], value: toWei("0.1") }))
                .receipt.blockNumber;
        });

        it("should have kept the balance", async function() {
            const balance = await web3.eth.getBalance(hashLotto.address);
            assert.strictEqual(balance, toWei("0.2"));
        });

        it("should have saved the Ticket", async function() {
            const ticket = await hashLotto.tickets(accounts[0]);
            assert.strictEqual(hexToUtf8(ticket[0]), "hello world");
            assert.strictEqual(ticket[1].toNumber(), blockMarked + 1);
        });

        it("should overwrite saved Ticket", async function() {
            blockMarked = (await hashLotto.markMyWord(utf8ToHex("not my world"), 2, { from: accounts[0], value: toWei("0.1") }))
                .receipt.blockNumber;
            const ticket = await hashLotto.tickets(accounts[0]);
            assert.strictEqual(hexToUtf8(ticket[0]), "not my world");
            assert.strictEqual(ticket[1].toNumber(), blockMarked + 2);
        });

    });

    it("should not be possible to toldYouSo before the block number is big enough", function() {
        return expectedExceptionPromise(
            () => hashLotto.toldYouSo(utf8ToHex("brag"), { from: accounts[0], gas: maxGas }),
            maxGas);
    });

    it("should not be possible to toldYouSo after 256 blocks without markMyWord first", async function() {
        if (!isTestRPC) this.skip("Needs TestRPC");
        const block = await web3.eth.getBlock("latest");
        if (block.number <= 256) {
            return await mineMany(256 - block.number);
        }
        await expectedExceptionPromise(
            () => hashLotto.toldYouSo(utf8ToHex("brag"), { from: accounts[0], gas: maxGas }),
            maxGas);
    });

    it("should not be possible to toldYouSo with hash 0 after 255 blocks", async function() {
        if (!isTestRPC) this.skip("Needs TestRPC");
        await hashLotto.markMyWord("0x0", 1, { from: accounts[0], value: toWei("0.1") });
        await mineMany(256);
        await expectedExceptionPromise(
            () => hashLotto.toldYouSo(utf8ToHex("brag"), { from: accounts[0], gas: maxGas }),
            maxGas);
    });

    it("should be possible to toldYouSo with hash 0 after 256 blocks", async function() {
        if (!isTestRPC) this.skip("Needs TestRPC");
        await hashLotto.markMyWord("0x0", 1, { from: accounts[0], value: toWei("0.1") });
        await mineMany(257);
        const txObj = await hashLotto.toldYouSo(utf8ToHex("brag"), { from: accounts[0] });
        assert.strictEqual(txObj.logs.length, 1);
        const toldYouEvent = txObj.logs[0];
        assert.strictEqual(toldYouEvent.args.who, accounts[0]);
        assert.strictEqual(hexToUtf8(toldYouEvent.args.braggingRights), "brag");
        const ticket = await hashLotto.tickets(accounts[0]);
        assert.strictEqual(hexToUtf8(ticket[0]), "");
        assert.strictEqual(ticket[1].toNumber(), 0);                
        const balance = await web3.eth.getBalance(hashLotto.address);
        assert.strictEqual(balance.toString(10), "0");
    });

});
