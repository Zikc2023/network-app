// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import React, { FC, useEffect, useMemo, useRef, useState } from 'react';
import { AiOutlineInfoCircle } from 'react-icons/ai';
import { specialApiKeyName } from '@components/GetEndpoint';
import { ApproveContract } from '@components/ModalApproveToken';
import TokenTooltip from '@components/TokenTooltip/TokenTooltip';
import { useSQToken } from '@containers';
import { SQT_TOKEN_ADDRESS } from '@containers/Web3';
import { useAddAllowance } from '@hooks/useAddAllowance';
import {
  GetUserApiKeys,
  IGetHostingPlans,
  IPostHostingPlansParams,
  isConsumerHostError,
  useConsumerHostServices,
} from '@hooks/useConsumerHostServices';
import { ProjectDetailsQuery } from '@hooks/useProjectFromQuery';
import { useSqtPrice } from '@hooks/useSqtPrice';
import { Steps, Typography } from '@subql/components';
import { formatSQT, useAsyncMemo } from '@subql/react-hooks';
import { parseError, TOKEN, tokenDecimals } from '@utils';
import { Button, Checkbox, Divider, Form, InputNumber, Radio } from 'antd';
import BigNumberJs from 'bignumber.js';
import clsx from 'clsx';
import { BigNumber } from 'ethers';
import { formatUnits, parseEther } from 'ethers/lib/utils';
import { useAccount } from 'wagmi';

import { useWeb3Store } from 'src/stores';

import styles from './index.module.less';

interface IProps {
  project: Pick<ProjectDetailsQuery, 'id'>;
  deploymentId: string;
  prevApiKey?: GetUserApiKeys;
  prevHostingPlan?: IGetHostingPlans;
  onSuccess?: () => void;
  onBack?: () => void;
}

const converFlexPlanPrice = (price: string) => {
  return BigNumberJs(formatUnits(price, tokenDecimals[SQT_TOKEN_ADDRESS])).multipliedBy(1000);
};

const CreateFlexPlan: FC<IProps> = ({ deploymentId, project, prevHostingPlan, prevApiKey, onSuccess, onBack }) => {
  const { address: account } = useAccount();
  const { contracts } = useWeb3Store();
  const [form] = Form.useForm<IPostHostingPlansParams>();
  const [depositForm] = Form.useForm<{ amount: string }>();
  const depositAmount = Form.useWatch<number>('amount', depositForm);
  const priceValue = Form.useWatch<number>('price', form);
  const { consumerHostAllowance, consumerHostBalance, balance } = useSQToken();
  const { addAllowance } = useAddAllowance();
  const sqtPrice = useSqtPrice();

  const mounted = useRef(false);

  const [currentStep, setCurrentStep] = React.useState(0);
  const [selectedPlan, setSelectedPlan] = useState<'economy' | 'performance' | 'custom'>('economy');
  const [nextBtnLoading, setNextBtnLoading] = useState(false);

  const [depositBalance] = useMemo(() => consumerHostBalance.result.data ?? [], [consumerHostBalance.result.data]);

  const { getProjects, createNewApiKey, createHostingPlanApi, updateHostingPlanApi, getUserApiKeysApi } =
    useConsumerHostServices({
      alert: true,
      autoLogin: false,
    });

  const flexPlans = useAsyncMemo(async () => {
    try {
      const res = await getProjects({
        projectId: BigNumber.from(project.id).toString(),
        deployment: deploymentId,
      });

      if (res.data?.indexers?.length) {
        return res.data.indexers;
      }
    } catch (e) {
      return [];
    }
  }, [project.id, deploymentId]);

  const estimatedPriceInfo = useMemo(() => {
    if (!flexPlans.data || flexPlans.data.length === 0) {
      return {
        economy: BigNumberJs(0),
        performance: BigNumberJs(0),
      };
    }

    // ASC
    const sortedFlexPlans = flexPlans.data.map((i) => converFlexPlanPrice(i.price)).sort((a, b) => (a.lt(b) ? -1 : 1));
    const maxPrice = sortedFlexPlans.at(-1);

    // if less than 3, both economy and performance should be the highest price
    if (flexPlans.data?.length <= 3) {
      return {
        economy: maxPrice,
        performance: maxPrice,
      };
    }

    if (flexPlans.data?.length <= 5) {
      return {
        economy: sortedFlexPlans[2],
        performance: maxPrice,
      };
    }

    const economyIndex = Math.ceil(flexPlans.data.length * 0.4) < 2 ? 2 : Math.ceil(flexPlans.data.length * 0.4);
    const performanceIndex = Math.ceil(flexPlans.data.length * 0.8) < 4 ? 4 : Math.ceil(flexPlans.data.length * 0.8);

    return {
      economy: sortedFlexPlans[economyIndex],
      performance: sortedFlexPlans[performanceIndex],
    };
  }, [flexPlans]);

  const matchedCount = React.useMemo(() => {
    if (!priceValue || !flexPlans.data?.length) return `Matched indexers: 0`;
    const count = flexPlans.data.filter((i) => {
      const prices1000 = converFlexPlanPrice(i.price);
      return prices1000.lte(priceValue);
    }).length;
    return `Matched indexers: ${count}`;
  }, [priceValue, flexPlans]);

  const enoughReq = useMemo(() => {
    const priceVal = priceValue || (form.getFieldsValue(true)['price'] as string);
    if (!priceVal || depositBalance?.eq(0) || !depositBalance) return 0;

    return BigNumberJs(formatSQT(depositBalance.toString()))
      .div(BigNumberJs(priceVal.toString()))
      .multipliedBy(1000)
      .decimalPlaces(0)
      ?.toNumber()
      ?.toLocaleString();
  }, [depositBalance, priceValue, form, currentStep]);

  const nextBtnText = useMemo(() => {
    if (currentStep === 0) return 'Next';

    if (currentStep === 1) return 'Deposit SQT';

    if (currentStep === 2) return 'Approve Transactions and Create Flex Plan';
    return 'Next';
  }, [currentStep]);

  const needAddAllowance = useMemo(() => {
    if (consumerHostAllowance.result.data?.eq(0) && depositAmount && depositAmount !== 0) return true;
    return BigNumberJs(formatSQT(consumerHostAllowance.result.data?.toString() || '0'))?.lt(depositAmount || 0);
  }, [depositAmount, consumerHostAllowance.result.data]);

  const needDepositMore = useMemo(() => {
    if (!depositAmount) return false;
    return true;
  }, [depositAmount]);

  const needCreateApiKey = useMemo(() => !prevApiKey, [prevApiKey]);

  const handleNextStep = async () => {
    if (currentStep === 0) {
      if (!selectedPlan) return;
      if (selectedPlan !== 'custom') {
        form.setFieldValue('price', estimatedPriceInfo[selectedPlan]?.toString());
        form.setFieldValue('maximum', selectedPlan === 'economy' ? 8 : 15);
      } else {
        await form.validateFields();
        form.setFieldValue('maximum', form.getFieldValue('maximum') || 2);
      }

      setCurrentStep(1);
    }

    if (currentStep === 1) {
      await depositForm.validateFields();
      setCurrentStep(2);
    }

    if (currentStep === 2) {
      setNextBtnLoading(true);
      try {
        if (needAddAllowance) {
          await addAllowance(ApproveContract.ConsumerHost, parseEther(depositAmount?.toString() || '0').toString());
          await consumerHostAllowance.refetch();
        }

        if (needDepositMore) {
          const tx = await contracts?.consumerHost.deposit(parseEther(depositAmount?.toString() || '0'), true);
          await tx?.wait();
          await consumerHostBalance.refetch();
          depositForm.setFieldValue('amount', 0);
        }

        if (needCreateApiKey) {
          // in case user create an api key at another tab, and back to this page to continue.
          const checkApiKeys = await getUserApiKeysApi();
          if (
            !isConsumerHostError(checkApiKeys.data) &&
            !checkApiKeys.data?.find((i) => i.name === specialApiKeyName)
          ) {
            const apiKeyRes = await createNewApiKey({
              name: specialApiKeyName,
            });
            if (isConsumerHostError(apiKeyRes.data)) {
              throw new Error(apiKeyRes.data.error);
              return;
            }
          }
        }

        const price = form.getFieldsValue(true)['price'];
        const maximum = form.getFieldsValue(true)['maximum'];

        const createOrUpdate = prevHostingPlan ? updateHostingPlanApi : createHostingPlanApi;
        // if already created the plan, just update it.
        const res = await createOrUpdate({
          deploymentId: deploymentId,
          price: parseEther(`${price}`).div(1000).toString(),
          maximum: Math.ceil(maximum),
          expiration: flexPlans?.data?.sort((a, b) => b.max_time - a.max_time)[0].max_time || 3600 * 24 * 7,
          id: prevHostingPlan?.id || '0',
        });

        if (isConsumerHostError(res.data)) {
          throw new Error(res.data.error);
          return;
        }

        await onSuccess?.();
      } catch (e) {
        parseError(e, {
          alert: true,
        });
      } finally {
        setNextBtnLoading(false);
      }
    }
  };

  const estimatedUs = (sqtAmount: string) => {
    return BigNumberJs(sqtPrice).multipliedBy(BigNumberJs(sqtAmount)).toNumber().toFixed(4);
  };

  // Just refetch when user change the account
  useEffect(() => {
    if (account && mounted.current) {
      consumerHostAllowance.refetch();
      consumerHostBalance.refetch();
      balance.refetch();
    } else {
      mounted.current = true;
    }
  }, [account]);

  return (
    <div className={styles.createFlexPlan}>
      <Steps
        current={currentStep}
        steps={[
          {
            title: 'Create Flex Plan',
          },
          {
            title: 'Deposit to Billing Account',
          },
          {
            title: 'Confirm',
          },
        ]}
      ></Steps>

      {currentStep === 0 && (
        <>
          <Typography>
            SubQuery will automatically allocate qualified indexers to your endpoint based on price and performance.
            Please select the type of plan you would like (you can change this later).
          </Typography>

          <div
            className={clsx(styles.radioCard, selectedPlan === 'economy' ? styles.radioCardSelected : '')}
            style={{ flexDirection: 'row', justifyContent: 'space-between' }}
            onClick={() => {
              setSelectedPlan('economy');
            }}
          >
            <div className="col-flex" style={{ gap: 8 }}>
              <Radio value={'free'} checked={selectedPlan === 'economy'}>
                <Typography weight={500}>Economy</Typography>
              </Radio>
              <Typography variant="medium" style={{ color: 'var(--sq-gray700)', maxWidth: 450 }}>
                We will set a lower cost limit which means less Node Operators will provide data to you, which may
                result in lower reliability and lower global performance. Best for use cases where cost is more
                important than reliability/performance.
              </Typography>
            </div>

            <div className="col-flex" style={{ alignItems: 'flex-end' }}>
              <Typography weight={600} variant="large" style={{ color: 'var(--sq-blue400)' }}>
                {estimatedPriceInfo.economy?.toFixed(2)} {TOKEN}
              </Typography>
              <Typography variant="medium">Per 1000 reqs</Typography>
              {sqtPrice !== '0' && (
                <Typography>(~US${estimatedUs(estimatedPriceInfo.economy?.toString() || '0')})</Typography>
              )}
            </div>
          </div>

          <div
            className={clsx(styles.radioCard, selectedPlan === 'performance' ? styles.radioCardSelected : '')}
            style={{ flexDirection: 'row', justifyContent: 'space-between' }}
            onClick={() => {
              setSelectedPlan('performance');
            }}
          >
            <div className="col-flex" style={{ gap: 8 }}>
              <Radio value={'free'} checked={selectedPlan === 'performance'}>
                <Typography weight={500}>Performance</Typography>
              </Radio>
              <Typography variant="medium" style={{ color: 'var(--sq-gray700)', maxWidth: 450 }}>
                We will set a higher cost limit which means more Node Operators will provide data to you, which
                generally results in higher reliability and higher global performance. Best for production use cases
                where reliability/performance is more important than cost.
              </Typography>
            </div>
            <div className="col-flex" style={{ alignItems: 'flex-end' }}>
              <Typography weight={600} variant="large" style={{ color: 'var(--sq-blue400)' }}>
                {estimatedPriceInfo.performance?.toFixed(2)} {TOKEN}
              </Typography>
              <Typography variant="medium">Per 1000 reqs</Typography>
              {sqtPrice !== '0' && (
                <Typography>(~US${estimatedUs(estimatedPriceInfo.performance?.toString() || '0')})</Typography>
              )}
            </div>
          </div>

          <div
            className={clsx(styles.radioCard, selectedPlan === 'custom' ? styles.radioCardSelected : '')}
            onClick={() => {
              setSelectedPlan('custom');
              if (selectedPlan !== 'custom') {
                form.resetFields();
              }
            }}
          >
            <Radio value={'free'} checked={selectedPlan === 'custom'}>
              <Typography weight={500}>Or enter a custom price (advanced users only)</Typography>
            </Radio>
            {selectedPlan === 'custom' && (
              <>
                <Typography variant="medium" style={{ color: 'var(--sq-gray700)', maxWidth: 450 }}>
                  Please enter a custom price, and an optional limit
                </Typography>

                <Form layout="vertical" className={styles.createFlexPlanModal} form={form}>
                  <Form.Item
                    label={
                      <Typography style={{ marginTop: 24 }}>
                        Maximum Price
                        <AiOutlineInfoCircle
                          style={{ fontSize: 14, marginLeft: 6, color: 'var(--sq-gray500)' }}
                        ></AiOutlineInfoCircle>
                      </Typography>
                    }
                    name="price"
                    rules={[{ required: true }]}
                  >
                    <InputNumber placeholder="Enter price" min="1" addonAfter={TOKEN}></InputNumber>
                  </Form.Item>
                  <Typography variant="medium" style={{ color: 'var(--sq-gray700)' }}>
                    Per 1000 requests
                  </Typography>
                  <Form.Item
                    label={
                      <Typography style={{ marginTop: 24 }}>
                        Maximum Allocated Node Operators
                        <AiOutlineInfoCircle
                          style={{ fontSize: 14, marginLeft: 6, color: 'var(--sq-gray500)' }}
                        ></AiOutlineInfoCircle>
                      </Typography>
                    }
                    name="maximum"
                  >
                    <InputNumber placeholder="Enter maximum allocated Node Operators" min="2"></InputNumber>
                  </Form.Item>
                  <Typography variant="medium" style={{ color: 'var(--sq-gray700)' }}>
                    {matchedCount}
                  </Typography>
                </Form>
              </>
            )}
          </div>
        </>
      )}

      {/* need the Form element render, so can trace the state */}
      <div className="col-flex" style={{ gap: 24, display: currentStep === 1 ? 'flex' : 'none' }}>
        <Typography>
          Every wallet has a Billing Account where you must deposit SQT that you authorise SubQuery to deduct for Flex
          Plan payments. If this Billing Account runs out of SQT, your Flex plan will automatically be cancelled and
          your endpoint may stop working.
        </Typography>
        <Typography>
          You can easily withdraw unused SQT from this Billing Account at any time without any unlocking period.
        </Typography>
        <Typography>
          We recommend ensuring that there is sufficient SQT in your billing account so that you don’t run out
          unexpectedly.
        </Typography>

        <div
          className={clsx(styles.radioCard, styles.radioCardSelected)}
          style={{ flexDirection: 'row', justifyContent: 'space-between', background: '#4388DD14' }}
        >
          <div className="col-flex">
            <Typography>Your selected plan:</Typography>

            <Typography style={{ textTransform: 'capitalize' }} weight={500}>
              {selectedPlan}
            </Typography>
          </div>
          <div className="col-flex" style={{ alignItems: 'flex-end' }}>
            <Typography weight={600} variant="large" style={{ color: 'var(--sq-blue400)' }}>
              {form.getFieldValue('price')} {TOKEN}
            </Typography>
            <Typography variant="medium">Per 1000 reqs</Typography>
            {sqtPrice !== '0' && <Typography>(~US${estimatedUs(form.getFieldValue('price'))})</Typography>}
          </div>
        </div>
        <Divider style={{ margin: 0 }}></Divider>
        <div className="col-flex" style={{ gap: 8 }}>
          {depositBalance?.eq(0) || !depositBalance ? (
            <>
              <Typography>You must deposit SQT to open this billing account</Typography>
              <Typography variant="medium" type="secondary">
                You must deposit SQT to create this flex plan
              </Typography>
            </>
          ) : (
            <>
              <Typography>
                Your existing billing account balance:{' '}
                {BigNumberJs(formatSQT(depositBalance.toString() || '0'))
                  .toNumber()
                  .toLocaleString()}{' '}
                {TOKEN}
              </Typography>
              <Typography variant="medium" type="secondary">
                This is enough to pay for {enoughReq} requests, we suggest{' '}
                {BigNumberJs(form.getFieldValue('price') || '0')
                  .multipliedBy(20)
                  .multipliedBy(form.getFieldValue('maximum') || 2)
                  .toNumber()
                  .toLocaleString()}{' '}
                {TOKEN}
              </Typography>
            </>
          )}
        </div>

        <Form layout="vertical" className={styles.createFlexPlanModal} form={depositForm}>
          <Form.Item
            label={<Typography>Deposit amount</Typography>}
            name="amount"
            rules={[{ type: 'number', required: true, min: 500 }]}
          >
            <InputNumber
              placeholder="Enter amount"
              addonAfter={
                <div className="flex" style={{ gap: 8 }}>
                  <img src="/static/sqtoken.png" alt=""></img>
                  {TOKEN}
                </div>
              }
            ></InputNumber>
          </Form.Item>
        </Form>

        <div className="col-flex" style={{ alignItems: 'flex-end' }}>
          <Typography variant="medium">Minimum deposit amount: 500 {TOKEN}</Typography>

          <Typography variant="medium">
            Wallet Balance:{' '}
            {BigNumberJs(formatSQT(balance.result.data?.toString() || '0'))
              .toNumber()
              .toLocaleString()}{' '}
            SQT <TokenTooltip></TokenTooltip>
          </Typography>
        </div>
      </div>

      {currentStep === 2 && (
        <>
          <Typography>
            You must now approve a few transactions using your connected wallet to initiate this Flex Plan. You must
            approve all transactions if in order to create a Flex Plan
          </Typography>

          <div
            className={clsx(styles.radioCard, !needAddAllowance ? styles.radioCardSelectedWithBackgroud : '')}
            style={{ flexDirection: 'row', justifyContent: 'space-between' }}
          >
            <div className="col-flex" style={{ gap: 8 }}>
              <Checkbox checked={!needAddAllowance}>
                <Typography>Authorise Billing Permissions</Typography>
              </Checkbox>
              <Typography variant="medium" type="secondary">
                This grants permission for SubQuery to manage your Billing Account automatically to pay node operators
                for charges incurred in this new Flex Plan
              </Typography>
            </div>
          </div>

          <div
            className={clsx(styles.radioCard, !needDepositMore ? styles.radioCardSelectedWithBackgroud : '')}
            style={{ flexDirection: 'row', justifyContent: 'space-between' }}
          >
            <div className="col-flex" style={{ gap: 8 }}>
              <Checkbox checked={!needDepositMore}>
                <Typography>Deposit Funds to Billing Account</Typography>
              </Checkbox>
              <Typography variant="medium" type="secondary">
                This is a transaction to deposit {depositForm.getFieldsValue(true)['amount'] || '0'} SQT into your
                personal Billing Account from your wallet balance.
              </Typography>
            </div>
          </div>

          <div
            className={clsx(styles.radioCard, !needCreateApiKey ? styles.radioCardSelectedWithBackgroud : '')}
            style={{ flexDirection: 'row', justifyContent: 'space-between' }}
          >
            <div className="col-flex" style={{ gap: 8 }}>
              <Checkbox checked={!needCreateApiKey}>
                <Typography>Create Personal API Key</Typography>
              </Checkbox>
              <Typography variant="medium" type="secondary">
                This is a transaction to open a state channel and generate a personal API key for your account to secure
                your new Flex Plan endpoint
              </Typography>
            </div>
          </div>
        </>
      )}

      <div className="flex">
        <Button
          shape="round"
          size="large"
          onClick={() => {
            if (currentStep === 0) {
              onBack?.();
            } else {
              setCurrentStep(currentStep - 1);
            }
          }}
        >
          Back
        </Button>
        <span style={{ flex: 1 }}></span>
        {currentStep === 1 && depositBalance?.gt(0) && (
          <Button
            shape="round"
            size="large"
            onClick={() => {
              depositForm.resetFields();
              setCurrentStep(2);
            }}
            style={{ marginRight: 12 }}
          >
            Skip without depositing more {TOKEN}
          </Button>
        )}
        <Button
          shape="round"
          size="large"
          type="primary"
          onClick={handleNextStep}
          loading={flexPlans.loading || nextBtnLoading}
        >
          {nextBtnText}
        </Button>
      </div>
    </div>
  );
};
export default CreateFlexPlan;
