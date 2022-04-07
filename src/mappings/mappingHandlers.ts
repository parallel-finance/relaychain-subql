import {
  SubstrateExtrinsic,
  SubstrateEvent,
  SubstrateBlock,
} from '@subql/types'
import { Balance } from '@polkadot/types/interfaces'
import {
  getAvailableBalances,
  getValidatorInfos,
  getParaIds,
  getSovereignAccounts,
  getStakingLedgers,
} from './utils'
import { ParachainInfo, Validator } from '../types'

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
        (await Validator.get(props.id)) ?? Validator.create(props)

      if (
        validator.commission !== props.commission ||
        validator.stakes !== props.stakes ||
        validator.name !== validator.name
      ) {
        validator.commission = props.commission
        validator.stakes = props.stakes
        validator.name = props.name
        validator.derivativeIndex = derivativeIndex
        validator.blockHeight = blockHeight
      }

      validator.save()
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
      id: paraId.toString(),
      sovAcc: sovereignAccounts[idx],
      deposited: availableBalances[idx],
      blockHeight,
    }
    const info =
      (await ParachainInfo.get(props.id)) ?? ParachainInfo.create(props)

    if (info.deposited !== props.deposited) {
      info.deposited = props.deposited
      info.blockHeight = blockHeight
    }

    info.save()
  }
}

export async function handleBlock(block: SubstrateBlock): Promise<void> {
  try {
    await Promise.all([handleValidators(block), handleParachainInfos(block)])
  } catch (e) {
    logger.error(`handle block error: ${e.message || e}`)
  }
}
