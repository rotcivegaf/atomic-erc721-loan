const TestToken = artifacts.require('TestToken');
const TestBorrower = artifacts.require('TestBorrower');

const AtomicErc20Loan = artifacts.require('AtomicErc20Loan');

const {
  bn,
  expect,
  toEvents,
  tryCatchRevert,
  maxUint,
  getEventFromTx,
} = require('./Helper.js');

contract('AtomicErc20Loan', (accounts) => {
  const signer = accounts[1];
  const anAddress = accounts[2];

  let signerBal = 0;
  let anAddressBal = 0;
  let atomicBal = 0;
  let borrowerCBal = 0;

  let erc20;

  let atomic;

  let borrowerC;

  async function saveBalances () {
    signerBal = await erc20.balanceOf(signer);
    anAddressBal = await erc20.balanceOf(anAddress);

    atomicBal = await erc20.balanceOf(atomic.address);
    borrowerCBal = await erc20.balanceOf(borrowerC.address);
  }

  async function setApproveBalance (beneficiary, amount) {
    await erc20.setBalance(beneficiary, amount);
    await erc20.approve(atomic.address, amount, { from: beneficiary });
  }

  async function calcSig (amount, price, signer) {
    const hash = web3.utils.soliditySha3(
      { t: 'address', v: atomic.address },
      { t: 'address', v: erc20.address },
      { t: 'uint256', v: amount },
      { t: 'uint256', v: price }
    );

    return web3.eth.sign(hash, signer);
  }

  before('Deploy contracts', async function () {
    atomic = await AtomicErc20Loan.new();

    erc20 = await TestToken.new();
    borrowerC = await TestBorrower.new(atomic.address);
  });

  describe('Function signedAtomicLoan', function () {
    it('Do a signed atomic loan', async () => {
      const signature = await calcSig(1, 0, signer);

      await setApproveBalance(signer, 1);

      await saveBalances();

      const tx = await borrowerC.signedAtomicLoan(
        erc20.address,
        1,
        0,
        signature,
        { from: anAddress }
      );

      const SignedAtomicLoan = getEventFromTx(tx, atomic.contract, 'SignedAtomicLoan');

      assert.equal(SignedAtomicLoan._token20, erc20.address);
      expect(SignedAtomicLoan._amount).to.eq.BN(1);
      expect(SignedAtomicLoan._price).to.eq.BN(0);
      assert.equal(SignedAtomicLoan._signature, signature);

      expect(await erc20.balanceOf(signer)).to.eq.BN(signerBal);
      expect(await erc20.balanceOf(anAddress)).to.eq.BN(anAddressBal);
      expect(await erc20.balanceOf(atomic.address)).to.eq.BN(atomicBal);
      expect(await erc20.balanceOf(borrowerC.address)).to.eq.BN(borrowerCBal);
    });
    it('try do a signed atomic loan without be a contract', async () => {
      const signature = await calcSig(1, 0, signer);

      await tryCatchRevert(
        () => atomic.signedAtomicLoan(
          erc20.address,
          1,
          0,
          signature,
          { from: anAddress }
        ),
        ''
      );
    });
    it('try do a signed atomic loan with a cancel signature', async () => {
      const signature = await calcSig(0, 0, signer);

      await atomic.cancelSignature(signature, { from: signer });

      await tryCatchRevert(
        () => borrowerC.signedAtomicLoan(
          erc20.address,
          0,
          0,
          signature,
          { from: signer }
        ),
        'signedAtomicLoan: The signature was canceled'
      );
    });
    it('try do a signed atomic loan but the borrower contract dont return the tokens', async () => {
      const signature = await calcSig(1, 0, signer);

      await borrowerC.setReturnTokens(false);

      await setApproveBalance(signer, 1);

      await tryCatchRevert(
        () => borrowerC.signedAtomicLoan(
          erc20.address,
          1,
          0,
          signature,
          { from: signer }
        ),
        'signedAtomicLoan: Error recover erc20 tokens'
      );
    });
    it('try do a signed atomic loan without approve founds', async () => {
      const signature = await calcSig(1, 0, signer);

      await erc20.approve(atomic.address, 0, { from: signer });

      await tryCatchRevert(
        () => borrowerC.signedAtomicLoan(
          erc20.address,
          1,
          0,
          signature,
          { from: signer }
        ),
        'signedAtomicLoan: Error lend erc20 tokens'
      );
    });
    it('try do a signed atomic loan without approve price founds', async () => {
      const signature = await calcSig(0, 1, signer);

      await erc20.approve(atomic.address, 0, { from: signer });

      await tryCatchRevert(
        () => borrowerC.signedAtomicLoan(
          erc20.address,
          0,
          1,
          signature,
          { from: signer }
        ),
        'signedAtomicLoan: Error pay erc20 tokens'
      );
    });
  });
  describe('Function cancelSignature', function () {
    it('cancel a signature', async () => {
      const signature = await calcSig(1000, 500, signer);

      assert.isFalse(await atomic.canceledSignatures(signer, signature));

      const CancelSignature = await toEvents(
        atomic.cancelSignature(
          signature,
          { from: signer }
        ),
        'CancelSignature'
      );

      assert.equal(CancelSignature._signature, signature);
      assert.isTrue(await atomic.canceledSignatures(signer, signature));
    });
  });
  describe('Function reApproveSignature', function () {
    it('Re-approve a signature', async () => {
      const signature = await calcSig(1000, 500, signer);
      await atomic.cancelSignature(signature, { from: signer });

      assert.isTrue(await atomic.canceledSignatures(signer, signature));

      const ReApproveSignature = await toEvents(
        atomic.reApproveSignature(
          signature,
          { from: signer }
        ),
        'ReApproveSignature'
      );

      assert.equal(ReApproveSignature._signature, signature);
      assert.isFalse(await atomic.canceledSignatures(signer, signature));
    });
  });
});