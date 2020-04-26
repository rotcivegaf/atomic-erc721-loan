const TestToken = artifacts.require('TestToken');
const TestERC721Token = artifacts.require('TestERC721Token');
const TestBorrower = artifacts.require('TestBorrower721');

const AtomicErc721Loan = artifacts.require('AtomicErc721Loan');

const {
  random10bn,
  expect,
  tryCatchRevert,
  getEventFromTx,
  toEvents,
  bn,
} = require('./Helper.js');

contract('AtomicErc721Loan', (accounts) => {
  const signer = accounts[1];
  const anAddress = accounts[2];
  const hightExpiry = bn('2').pow(bn('256')).sub(bn('1'));

  let signerBal = 0;
  let anAddressBal = 0;
  let atomicBal = 0;
  let borrowerCBal = 0;

  let erc20;
  let erc721;

  let atomic;

  let borrowerC;

  async function saveBalances () {
    signerBal = await erc20.balanceOf(signer);
    anAddressBal = await erc20.balanceOf(anAddress);

    atomicBal = await erc20.balanceOf(atomic.address);
    borrowerCBal = await erc20.balanceOf(borrowerC.address);
  }

  async function createApprove (beneficiary, tokenId) {
    await erc721.generate(beneficiary, tokenId);
    await erc721.approve(atomic.address, tokenId, { from: beneficiary });
  }

  function calcHash (tokenId, price, expiry) {
    return web3.utils.soliditySha3(
      { t: 'address', v: atomic.address },
      { t: 'address', v: erc721.address },
      { t: 'uint256', v: tokenId },
      { t: 'address', v: erc20.address },
      { t: 'uint256', v: price },
      { t: 'uint256', v: expiry }
    );
  }

  async function calcSig (tokenId, price, expiry, signer) {
    const loanHash = calcHash(tokenId, price, expiry);
    const signature = await web3.eth.sign(loanHash, signer);

    return {
      loanHash: loanHash,
      v: 27 + web3.utils.hexToNumber(signature.slice(130, 132)),
      r: signature.slice(0, 66),
      s: '0x' + signature.slice(66, 130),
    };
  }

  before('Deploy contracts', async function () {
    atomic = await AtomicErc721Loan.new();

    erc20 = await TestToken.new();
    erc721 = await TestERC721Token.new();
    borrowerC = await TestBorrower.new(atomic.address);
  });

  it('Function cancelHash', async () => {
    const tokenId = random10bn();
    const price = random10bn();
    const vrs = await calcSig(tokenId, price, hightExpiry, signer);

    assert.isFalse(await atomic.canceledHashes(signer, vrs.loanHash));

    const CancelHash = await toEvents(
      atomic.cancelHash(
        erc721.address,
        tokenId,
        erc20.address,
        price,
        hightExpiry,
        { from: signer }
      ),
      'CancelHash'
    );

    assert.equal(CancelHash._token721, erc721.address);
    expect(CancelHash._tokenId).to.eq.BN(tokenId);
    assert.equal(CancelHash._token20, erc20.address);
    expect(CancelHash._price).to.eq.BN(price);
    expect(CancelHash._expiry).to.eq.BN(hightExpiry);

    assert.isTrue(await atomic.canceledHashes(signer, vrs.loanHash));
  });

  it('Re-approve a hash', async () => {
    const tokenId = random10bn();
    const price = random10bn();
    const vrs = await calcSig(tokenId, price, hightExpiry, signer);

    await atomic.cancelHash(erc721.address, tokenId, erc20.address, price, hightExpiry, { from: signer });

    assert.isTrue(await atomic.canceledHashes(signer, vrs.loanHash));

    const ReApproveHash = await toEvents(
      atomic.reApproveHash(
        erc721.address,
        tokenId,
        erc20.address,
        price,
        hightExpiry,
        { from: signer }
      ),
      'ReApproveHash'
    );

    assert.equal(ReApproveHash._token721, erc721.address);
    expect(ReApproveHash._tokenId).to.eq.BN(tokenId);
    assert.equal(ReApproveHash._token20, erc20.address);
    expect(ReApproveHash._price).to.eq.BN(price);
    expect(ReApproveHash._expiry).to.eq.BN(hightExpiry);

    assert.isFalse(await atomic.canceledHashes(signer, vrs.loanHash));
  });

  describe('Function signedAtomicLoan', function () {
    it('Do a signed atomic loan', async () => {
      const tokenId = random10bn();
      const vrs = await calcSig(tokenId, 0, hightExpiry, signer);

      await createApprove(signer, tokenId);
      await erc20.setBalance(borrowerC.address, 0);

      await saveBalances();

      const tx = await borrowerC.signedAtomicLoan(
        erc721.address,
        tokenId,
        erc20.address,
        0,
        hightExpiry,
        vrs.v,
        vrs.r,
        vrs.s,
        { from: anAddress }
      );

      const AtomicLoan = getEventFromTx(tx, atomic.contract, 'AtomicLoan');

      assert.equal(AtomicLoan._owner, signer);
      assert.equal(AtomicLoan._token721, erc721.address);
      expect(AtomicLoan._tokenId).to.eq.BN(tokenId);
      assert.equal(AtomicLoan._token20, erc20.address);
      expect(AtomicLoan._price).to.eq.BN(0);
      expect(AtomicLoan._expiry).to.eq.BN(hightExpiry);

      assert.equal(await erc721.ownerOf(tokenId), signer);

      expect(await erc20.balanceOf(signer)).to.eq.BN(signerBal);
      expect(await erc20.balanceOf(anAddress)).to.eq.BN(anAddressBal);
      expect(await erc20.balanceOf(atomic.address)).to.eq.BN(atomicBal);
      expect(await erc20.balanceOf(borrowerC.address)).to.eq.BN(borrowerCBal);
    });
    it('Do a signed atomic loan with price', async () => {
      const tokenId = random10bn();
      const price = random10bn();
      const vrs = await calcSig(tokenId, price, hightExpiry, signer);

      await createApprove(signer, tokenId);
      await erc20.setBalance(borrowerC.address, price);

      await saveBalances();

      const tx = await borrowerC.signedAtomicLoan(
        erc721.address,
        tokenId,
        erc20.address,
        price,
        hightExpiry,
        vrs.v,
        vrs.r,
        vrs.s,
        { from: anAddress }
      );

      const AtomicLoan = getEventFromTx(tx, atomic.contract, 'AtomicLoan');

      assert.equal(AtomicLoan._owner, signer);
      assert.equal(AtomicLoan._token721, erc721.address);
      expect(AtomicLoan._tokenId).to.eq.BN(tokenId);
      assert.equal(AtomicLoan._token20, erc20.address);
      expect(AtomicLoan._price).to.eq.BN(price);
      expect(AtomicLoan._expiry).to.eq.BN(hightExpiry);

      assert.equal(await erc721.ownerOf(tokenId), signer);

      expect(await erc20.balanceOf(signer)).to.eq.BN(signerBal.add(price));
      expect(await erc20.balanceOf(anAddress)).to.eq.BN(anAddressBal);
      expect(await erc20.balanceOf(atomic.address)).to.eq.BN(atomicBal);
      expect(await erc20.balanceOf(borrowerC.address)).to.eq.BN(borrowerCBal.sub(price));
    });
    it('try do a signed atomic loan with expired signature', async () => {
      const tokenId = random10bn();
      const vrs = await calcSig(tokenId, 0, 0, signer);

      await createApprove(signer, tokenId);

      await tryCatchRevert(
        () => borrowerC.signedAtomicLoan(
          erc721.address,
          tokenId,
          erc20.address,
          0,
          0,
          vrs.v,
          vrs.r,
          vrs.s,
          { from: anAddress }
        ),
        'signedAtomicLoan: The signature has expired'
      );

      await borrowerC.setReturnToken(true);
    });
    it('try do a signed loan without be a contract', async () => {
      const vrs = await calcSig(0, 0, hightExpiry, signer);

      await tryCatchRevert(
        () => atomic.signedAtomicLoan(
          erc721.address,
          0,
          erc20.address,
          0,
          hightExpiry,
          vrs.v,
          vrs.r,
          vrs.s,
          { from: anAddress }
        ),
        ''
      );
    });
    it('try do a signed loan without pay the price', async () => {
      const tokenId = random10bn();
      const vrs = await calcSig(tokenId, 1, hightExpiry, signer);

      await createApprove(signer, tokenId);
      await erc20.setBalance(borrowerC.address, 0);

      await tryCatchRevert(
        () => borrowerC.signedAtomicLoan(
          erc721.address,
          tokenId,
          erc20.address,
          1,
          hightExpiry,
          vrs.v,
          vrs.r,
          vrs.s,
          { from: anAddress }
        ),
        'pay: error transfer erc20 tokens'
      );

      await borrowerC.setPayPrice(false);

      await erc20.setBalance(borrowerC.address, 1);

      await tryCatchRevert(
        () => borrowerC.signedAtomicLoan(
          erc721.address,
          tokenId,
          erc20.address,
          1,
          hightExpiry,
          vrs.v,
          vrs.r,
          vrs.s,
          { from: anAddress }
        ),
        'signedAtomicLoan: Error pay the loan price'
      );
    });
    it('try do a signed loan but the borrower contract dont return the erc721 token', async () => {
      const tokenId = random10bn();
      const vrs = await calcSig(tokenId, 0, hightExpiry, signer);

      await createApprove(signer, tokenId);
      await borrowerC.setReturnToken(false);

      await tryCatchRevert(
        () => borrowerC.signedAtomicLoan(
          erc721.address,
          tokenId,
          erc20.address,
          0,
          hightExpiry,
          vrs.v,
          vrs.r,
          vrs.s,
          { from: anAddress }
        ),
        'signedAtomicLoan: Error return erc721 token'
      );

      await borrowerC.setReturnToken(true);
    });
    it('try do a signed atomic loan with a cancel hash', async () => {
      const vrs = await calcSig(0, 0, hightExpiry, signer);

      await atomic.cancelHash(erc721.address, 0, erc20.address, 0, hightExpiry, { from: signer });

      await tryCatchRevert(
        () => borrowerC.signedAtomicLoan(
          erc721.address,
          0,
          erc20.address,
          0,
          hightExpiry,
          vrs.v,
          vrs.r,
          vrs.s,
          { from: signer }
        ),
        'signedAtomicLoan: The loan hash was canceled'
      );

      await atomic.cancelHash(erc721.address, 0, erc20.address, 0, hightExpiry, { from: signer });
    });
  });
});
