import {
  stringToU8a,
  u8aToBigInt,
  u8aToString,
  u8aConcat,
  bnToU8a,
  u8aToHex,
} from '@polkadot/util'
import { blake2AsU8a } from '@polkadot/util-crypto'
import { ParaId, AccountId } from '@polkadot/types/interfaces'
import { Vec } from '@polkadot/types'
import { encodeAddress, decodeAddress } from '@polkadot/keyring'

const DERIVATIVE_INDEX_LIST = [0]

const HEIKO_PARA_ID = 2085
const PARALLEL_PARA_ID = 2012

const EMPTY_U8A_32 = new Uint8Array(32)

export const sovereignAccountOf = (paraId: ParaId | number): string =>
  encodeAddress(
    u8aConcat(
      stringToU8a('para'),
      bnToU8a(paraId, 32, true),
      EMPTY_U8A_32
    ).subarray(0, 32)
  )

export const subAccountId = (signer: string, index: number): string => {
  const seedBytes = stringToU8a('modlpy/utilisuba')
  const whoBytes = decodeAddress(signer)
  const indexBytes = bnToU8a(index, 16).reverse()
  const combinedBytes = new Uint8Array(
    seedBytes.length + whoBytes.length + indexBytes.length
  )
  combinedBytes.set(seedBytes)
  combinedBytes.set(whoBytes, seedBytes.length)
  combinedBytes.set(indexBytes, seedBytes.length + whoBytes.length)

  const entropy = blake2AsU8a(combinedBytes, 256)
  return encodeAddress(entropy)
}

export const getParaIds = async (): Promise<number[]> => {
  const paraIds = (await api.query.paras.parachains()) as unknown as Vec<ParaId>
  return paraIds.map((id) => id.toNumber())
}

export const getSovereignAccounts = (paraIds: number[]): string[] => {
  return paraIds.map((id) => sovereignAccountOf(id))
}

export const getAvailableBalances = async (
  accounts: string[]
): Promise<string[]> => {
  const accountInfos = await api.query.system.account.multi(accounts)
  return accountInfos.map((info) =>
    info.data.free.toBn().sub(info.data.miscFrozen.toBn()).toString()
  )
}

export const getStakingLedgers = async (): Promise<string[]> => {
  const chain = (await api.rpc.system.chain()).toString()

  let paraId
  if (chain.startsWith('Kusama')) {
    paraId = HEIKO_PARA_ID
  } else if (chain.startsWith('Polkadot')) {
    paraId = PARALLEL_PARA_ID
  } else {
    return []
  }

  const sovAcc = sovereignAccountOf(paraId)
  return DERIVATIVE_INDEX_LIST.map((idx) => subAccountId(sovAcc, idx))
}

export const getIdentity = async (account: AccountId): Promise<string> => {
  const identity = await api.query.identity.identityOf(account)
  const superOf = await api.query.identity.superOf(account)
  if (identity.isSome) {
    return u8aToString(identity.unwrap().info.display.asRaw)
  }
  if (superOf.isSome) {
    const superIdentity = await api.query.identity.identityOf(
      superOf.unwrap()[0].toString()
    )
    const idx = u8aToBigInt(superOf.unwrap()[1].asRaw)
    if (superIdentity.isSome) {
      return `${u8aToString(
        superIdentity.unwrap().info.display.asRaw
      )}/${idx.toString()}`
    }
  }
  return ''
}

export const getTotalStakes = async (validator: AccountId): Promise<string> => {
  const currentEra = (await api.query.staking.currentEra()).unwrapOrDefault()
  const exposure = await api.query.staking.erasStakersClipped(
    currentEra,
    validator
  )
  return exposure.total.toBn().toString()
}

export const getCommission = async (validator: AccountId): Promise<string> => {
  const prefs = await api.query.staking.validators(validator)
  return prefs.commission.toBn().toString()
}

export const getValidatorInfos = async (nominator: string) => {
  const validatorsOp = await api.query.staking.nominators(nominator)
  if (validatorsOp.isNone) {
    return []
  }
  return Promise.all(
    validatorsOp.unwrap().targets.map(async (v) => ({
      stashId: v.toString(),
      name: await getIdentity(v),
      stakes: await getTotalStakes(v),
      commission: await getCommission(v),
    }))
  )
}
