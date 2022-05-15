import {
  SubstrateExtrinsic,
  SubstrateEvent,
  SubstrateBlock,
} from '@subql/types'
import { Balance, AccountId } from '@polkadot/types/interfaces'
import { BN } from '@polkadot/util'
import {
  getAvailableBalances,
  getValidatorInfos,
  getParaIds,
  getSovereignAccounts,
  getStakingLedgers,
} from './utils'
import { ParachainInfo, Reward, Validator } from '../types'

export async function handleValidators(block: SubstrateBlock) {
  const stakingLedgers = await getStakingLedgers()
  const blockHeight = block.block.header.number.toNumber()
  for (const [derivativeIndex, stakingLedger] of stakingLedgers.entries()) {
    const validatorInfos = await getValidatorInfos(stakingLedger)
    for (const [idx, info] of validatorInfos.entries()) {
      const props = {
        id: `${derivativeIndex}-${idx}`,
        derivativeIndex,
        ...info,
        blockHeight,
      }

      const validator =
        (await Validator.get(props.id)) ?? (await Validator.create(props))

      if (
        validator.commission !== props.commission ||
        validator.stakes !== props.stakes ||
        validator.name !== validator.name
      ) {
        validator.commission = props.commission
        validator.stakes = props.stakes
        validator.name = props.name
        validator.blockHeight = blockHeight
      }

      await validator.save()
    }

    for (const idx of [...Array(24).keys()].slice(validatorInfos.length)) {
      await Validator.remove(`${derivativeIndex}-${idx}`)
    }
  }
}

export async function handleParachainInfos(block: SubstrateBlock) {
  const paraIds = await getParaIds()
  const sovereignAccounts = await getSovereignAccounts(paraIds)
  const availableBalances = await getAvailableBalances(sovereignAccounts)
  const blockHeight = block.block.header.number.toNumber()
  for (const [idx, paraId] of paraIds.entries()) {
    const props = {
      id: `${block.block.header.hash.toString()}-${paraId.toString()}`,
      paraId,
      sovAcc: sovereignAccounts[idx],
      deposited: availableBalances[idx],
      blockHeight,
      timestamp: block.timestamp,
    }
    const info =
      (await ParachainInfo.get(props.id)) ?? ParachainInfo.create(props)

    if (info.deposited !== props.deposited) {
      info.deposited = props.deposited
      info.blockHeight = props.blockHeight
      info.timestamp = props.timestamp
    }

    await info.save()
  }
}

export async function handleEvent(event: SubstrateEvent) {
  const stakingLedgers = await getStakingLedgers()
  const beneficiary = event.event.data[0] as AccountId
  const amount = event.event.data[1] as Balance
  const derivativeIndex = stakingLedgers.indexOf(beneficiary.toString())
  if (derivativeIndex < 0) {
    return
  }

  let id = `${beneficiary.toString()}`
  let reward = await Reward.get(id)
  if (!reward) {
    reward = Reward.create({
      id,
      derivativeIndex,
      amount: amount.toString(),
    })
    return
  }

  reward.amount = amount.toBn().add(new BN(reward.amount)).toString()
  await reward.save()
}

export async function handleBlock(block: SubstrateBlock): Promise<void> {
  const blockNumber = block.block.header.number.toNumber()
  if (blockNumber % 600 !== 0) {
    return
  }
  try {
    await Promise.all([handleValidators(block), handleParachainInfos(block)])
  } catch (e) {
    logger.error(e.message)
  }
}
