const TestToken = artifacts.require('TestToken');
const TestBorrower = artifacts.require('TestBorrower20');

const AtomicErc20Loan = artifacts.require('AtomicErc20Loan');

const {
  bn,
  random32bn,
  expect,
  tryCatchRevert,
  getEventFromTx,
  toEvents,
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

  const WEI = bn(web3.utils.toWei('1'));
  const BASE = bn(10000);

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

  async function calcSig (fee, signer) {
    const hash = web3.utils.soliditySha3(
      { t: 'address', v: atomic.address },
      { t: 'address', v: erc20.address },
      { t: 'uint256', v: fee }
    );

    const signature = await web3.eth.sign(hash, signer);

    return {
      loanHash: hash,
      v: 27 + web3.utils.hexToNumber(signature.slice(130, 132)),
      r: signature.slice(0, 66),
      s: '0x' + signature.slice(66, 130),
    };
  }

  function calcPrice (amount, fee) {
    return amount.mul(fee).div(BASE);
  }

  before('Deploy contracts', async function () {
    atomic = await AtomicErc20Loan.new();

    erc20 = await TestToken.new();
    borrowerC = await TestBorrower.new(atomic.address);
  });

  it('Function cancelHash', async () => {
    const fee = random32bn();
    const vrs = await calcSig(fee, signer);

    assert.isFalse(await atomic.canceledHashes(signer, vrs.loanHash));

    const CancelHash = await toEvents(
      atomic.cancelHash(
        erc20.address,
        fee,
        { from: signer }
      ),
      'CancelHash'
    );

    assert.equal(CancelHash._token20, erc20.address);
    expect(CancelHash._fee).to.eq.BN(fee);

    assert.isTrue(await atomic.canceledHashes(signer, vrs.loanHash));
  });
  it('Re-approve a hash', async () => {
    const fee = random32bn();
    const vrs = await calcSig(fee, signer);

    await atomic.cancelHash(erc20.address, fee, { from: signer });

    assert.isTrue(await atomic.canceledHashes(signer, vrs.loanHash));

    const ReApproveHash = await toEvents(
      atomic.reApproveHash(
        erc20.address,
        fee,
        { from: signer }
      ),
      'ReApproveHash'
    );

    assert.equal(ReApproveHash._token20, erc20.address);
    expect(ReApproveHash._fee).to.eq.BN(fee);

    assert.isFalse(await atomic.canceledHashes(signer, vrs.loanHash));
  });

  describe('Function signedAtomicLoan', function () {
    it('Do a signed atomic loan with 0 amount and 0% fee', async () => {
      const vrs = await calcSig(0, signer);

      await saveBalances();

      const tx = await borrowerC.signedAtomicLoan(
        erc20.address,
        0,
        vrs.v,
        vrs.r,
        vrs.s,
        { from: anAddress }
      );

      const SignedAtomicLoan = getEventFromTx(tx, atomic.contract, 'SignedAtomicLoan');

      assert.equal(SignedAtomicLoan._owner, signer);
      assert.equal(SignedAtomicLoan._token20, erc20.address);
      expect(SignedAtomicLoan._amount).to.eq.BN(0);
      expect(SignedAtomicLoan._fee).to.eq.BN(0);
      assert.equal(SignedAtomicLoan._loanHash, vrs.loanHash);

      expect(await erc20.balanceOf(signer)).to.eq.BN(signerBal);
      expect(await erc20.balanceOf(anAddress)).to.eq.BN(anAddressBal);
      expect(await erc20.balanceOf(atomic.address)).to.eq.BN(atomicBal);
      expect(await erc20.balanceOf(borrowerC.address)).to.eq.BN(borrowerCBal);
    });
    it('Do a signed atomic loan with 1 WEI amount and 0% fee', async () => {
      const vrs = await calcSig(0, signer);

      await setApproveBalance(signer, WEI);

      await saveBalances();

      const tx = await borrowerC.signedAtomicLoan(
        erc20.address,
        0,
        vrs.v,
        vrs.r,
        vrs.s,
        { from: anAddress }
      );

      const SignedAtomicLoan = getEventFromTx(tx, atomic.contract, 'SignedAtomicLoan');

      assert.equal(SignedAtomicLoan._owner, signer);
      assert.equal(SignedAtomicLoan._token20, erc20.address);
      expect(SignedAtomicLoan._amount).to.eq.BN(WEI);
      expect(SignedAtomicLoan._fee).to.eq.BN(0);
      assert.equal(SignedAtomicLoan._loanHash, vrs.loanHash);

      expect(await erc20.balanceOf(signer)).to.eq.BN(signerBal);
      expect(await erc20.balanceOf(anAddress)).to.eq.BN(anAddressBal);
      expect(await erc20.balanceOf(atomic.address)).to.eq.BN(atomicBal);
      expect(await erc20.balanceOf(borrowerC.address)).to.eq.BN(borrowerCBal);
    });
    it('Do a signed atomic loan with 0 amount and 10% fee', async () => {
      const fee = bn(1000);
      const vrs = await calcSig(fee, signer);

      await saveBalances();

      const tx = await borrowerC.signedAtomicLoan(
        erc20.address,
        fee,
        vrs.v,
        vrs.r,
        vrs.s,
        { from: anAddress }
      );

      const SignedAtomicLoan = getEventFromTx(tx, atomic.contract, 'SignedAtomicLoan');

      assert.equal(SignedAtomicLoan._owner, signer);
      assert.equal(SignedAtomicLoan._token20, erc20.address);
      expect(SignedAtomicLoan._amount).to.eq.BN(0);
      expect(SignedAtomicLoan._fee).to.eq.BN(fee);
      assert.equal(SignedAtomicLoan._loanHash, vrs.loanHash);

      expect(await erc20.balanceOf(signer)).to.eq.BN(signerBal);
      expect(await erc20.balanceOf(anAddress)).to.eq.BN(anAddressBal);
      expect(await erc20.balanceOf(atomic.address)).to.eq.BN(atomicBal);
      expect(await erc20.balanceOf(borrowerC.address)).to.eq.BN(borrowerCBal);
    });
    it('Do a signed atomic loan with 1 WEI amount and 10% fee', async () => {
      const fee = bn(1000);
      const vrs = await calcSig(fee, signer);

      await setApproveBalance(signer, WEI);
      const price = calcPrice(WEI, fee);
      await erc20.setBalance(borrowerC.address, price);

      await saveBalances();

      const tx = await borrowerC.signedAtomicLoan(
        erc20.address,
        fee,
        vrs.v,
        vrs.r,
        vrs.s,
        { from: anAddress }
      );

      const SignedAtomicLoan = getEventFromTx(tx, atomic.contract, 'SignedAtomicLoan');

      assert.equal(SignedAtomicLoan._owner, signer);
      assert.equal(SignedAtomicLoan._token20, erc20.address);
      expect(SignedAtomicLoan._amount).to.eq.BN(WEI);
      expect(SignedAtomicLoan._fee).to.eq.BN(fee);
      assert.equal(SignedAtomicLoan._loanHash, vrs.loanHash);

      expect(await erc20.balanceOf(signer)).to.eq.BN(signerBal.add(price));
      expect(await erc20.balanceOf(anAddress)).to.eq.BN(anAddressBal);
      expect(await erc20.balanceOf(atomic.address)).to.eq.BN(atomicBal);
      expect(await erc20.balanceOf(borrowerC.address)).to.eq.BN(borrowerCBal.sub(price));
    });
    it('Approve more than balance', async () => {
      const vrs = await calcSig(0, signer);

      await erc20.setBalance(signer, WEI);
      await erc20.approve(atomic.address, WEI.mul(bn(2)), { from: signer });

      await saveBalances();

      const tx = await borrowerC.signedAtomicLoan(
        erc20.address,
        0,
        vrs.v,
        vrs.r,
        vrs.s,
        { from: anAddress }
      );

      const SignedAtomicLoan = getEventFromTx(tx, atomic.contract, 'SignedAtomicLoan');

      assert.equal(SignedAtomicLoan._owner, signer);
      assert.equal(SignedAtomicLoan._token20, erc20.address);
      expect(SignedAtomicLoan._amount).to.eq.BN(WEI);
      expect(SignedAtomicLoan._fee).to.eq.BN(0);
      assert.equal(SignedAtomicLoan._loanHash, vrs.loanHash);

      expect(await erc20.balanceOf(signer)).to.eq.BN(signerBal);
      expect(await erc20.balanceOf(anAddress)).to.eq.BN(anAddressBal);
      expect(await erc20.balanceOf(atomic.address)).to.eq.BN(atomicBal);
      expect(await erc20.balanceOf(borrowerC.address)).to.eq.BN(borrowerCBal);
    });
    it('Approve less than balance', async () => {
      const vrs = await calcSig(0, signer);

      await erc20.setBalance(signer, WEI.mul(bn(2)));
      await erc20.approve(atomic.address, WEI, { from: signer });

      await saveBalances();

      const tx = await borrowerC.signedAtomicLoan(
        erc20.address,
        0,
        vrs.v,
        vrs.r,
        vrs.s,
        { from: anAddress }
      );

      const SignedAtomicLoan = getEventFromTx(tx, atomic.contract, 'SignedAtomicLoan');

      assert.equal(SignedAtomicLoan._owner, signer);
      assert.equal(SignedAtomicLoan._token20, erc20.address);
      expect(SignedAtomicLoan._amount).to.eq.BN(WEI);
      expect(SignedAtomicLoan._fee).to.eq.BN(0);
      assert.equal(SignedAtomicLoan._loanHash, vrs.loanHash);

      expect(await erc20.balanceOf(signer)).to.eq.BN(signerBal);
      expect(await erc20.balanceOf(anAddress)).to.eq.BN(anAddressBal);
      expect(await erc20.balanceOf(atomic.address)).to.eq.BN(atomicBal);
      expect(await erc20.balanceOf(borrowerC.address)).to.eq.BN(borrowerCBal);
    });
    it('try do a signed atomic loan without be a contract', async () => {
      const vrs = await calcSig(0, signer);

      await tryCatchRevert(
        () => atomic.signedAtomicLoan(
          erc20.address,
          0,
          vrs.v,
          vrs.r,
          vrs.s,
          { from: anAddress }
        ),
        ''
      );
    });
    it('try do a signed atomic loan with a cancel hash', async () => {
      const vrs = await calcSig(0, signer);

      await atomic.cancelHash(erc20.address, 0, { from: signer });

      await tryCatchRevert(
        () => borrowerC.signedAtomicLoan(
          erc20.address,
          0,
          vrs.v,
          vrs.r,
          vrs.s,
          { from: signer }
        ),
        'signedAtomicLoan: The loan hash was canceled'
      );
      await atomic.reApproveHash(erc20.address, 0, { from: signer });
    });
    it('try do a signed atomic loan and not return the founds', async () => {
      const vrs = await calcSig(0, signer);

      await setApproveBalance(signer, WEI);
      await borrowerC.setNotReturn();

      await tryCatchRevert(
        () => borrowerC.signedAtomicLoan(
          erc20.address,
          0,
          vrs.v,
          vrs.r,
          vrs.s,
          { from: signer }
        ),
        'Sub overflow'
      );
    });
    it('try do a signed atomic loan and not pay', async () => {
      const fee = bn(1000);
      const vrs = await calcSig(fee, signer);

      await setApproveBalance(signer, WEI);
      await borrowerC.setNotPay();

      await tryCatchRevert(
        () => borrowerC.signedAtomicLoan(
          erc20.address,
          fee,
          vrs.v,
          vrs.r,
          vrs.s,
          { from: signer }
        ),
        'signedAtomicLoan: Error recover erc20 token and pay the loan price'
      );
    });
  });
});
