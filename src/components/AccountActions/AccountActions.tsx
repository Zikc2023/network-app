// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { AiOutlineDown } from 'react-icons/ai';
import { BsBoxArrowInUpRight, BsBoxArrowLeft, BsInfoCircle } from 'react-icons/bs';
import { IoWarning } from 'react-icons/io5';
import { useNavigate } from 'react-router';
import InfoCircleOutlined from '@ant-design/icons/InfoCircleOutlined';
import { SQT_TOKEN_ADDRESS } from '@containers/Web3';
import { Address, Spinner, Typography } from '@subql/components';
import { formatSQT } from '@subql/react-hooks';
import { Button, Dropdown, Tooltip } from 'antd';
import BigNumberJs from 'bignumber.js';
import { useDisconnect, useWalletClient } from 'wagmi';

import { BRIDGE_URL } from 'src/const/bridge';

import { useSQToken } from '../../containers';
import {
  formatEther,
  formatNumberWithLocale,
  ROUTES,
  STABLE_TOKEN,
  STABLE_TOKEN_ADDRESS,
  TOKEN,
  tokenDecimals,
} from '../../utils';
import styles from './AccountActions.module.less';

export const AccountActions: React.FC<{ account: string }> = ({ account }) => {
  const { t } = useTranslation();
  const { disconnect } = useDisconnect();
  const navigate = useNavigate();
  const { balance, ethSqtBalance, consumerHostBalance } = useSQToken();
  const { data: walletClient } = useWalletClient();
  const handleDisconnect = () => disconnect();
  const handleNavRewards = () => navigate(ROUTES.MY_PROFILE_REWARDS_NAV);
  const handleNavWithdrawn = () => navigate(ROUTES.MY_PROFILE_WITHDRAWN_NAV);
  const handleNavAccount = () => navigate(ROUTES.MY_PROFILE);
  const handleAddToken = () => {
    walletClient?.request({
      method: 'wallet_watchAsset',
      params: {
        type: 'ERC20',
        options: {
          address: SQT_TOKEN_ADDRESS,
          symbol: TOKEN,
          decimals: tokenDecimals[SQT_TOKEN_ADDRESS],
        },
      },
    });
  };

  const handleAddStableToken = () => {
    walletClient?.request({
      method: 'wallet_watchAsset',
      params: {
        type: 'ERC20',
        options: {
          address: STABLE_TOKEN_ADDRESS,
          symbol: STABLE_TOKEN,
          decimals: tokenDecimals[STABLE_TOKEN_ADDRESS],
        },
      },
    });
  };

  const [open, setOpen] = React.useState(false);

  const minDeposit = React.useMemo(() => {
    return 400;
  }, []);

  const warnDeposit = React.useMemo(() => {
    if (!consumerHostBalance.result.loading && open) {
      if (
        !BigNumberJs(formatSQT(consumerHostBalance.result?.data?.balance.toString() || '0')).isZero() &&
        BigNumberJs(formatSQT(consumerHostBalance.result.data?.balance?.toString() || '0')).lt(minDeposit)
      ) {
        return (
          <Tooltip title="Your Billing account balance is running low. Please top up your Billing account promptly to avoid any disruption in usage.">
            <IoWarning style={{ fontSize: 16, color: 'var(--sq-error)', marginLeft: 8 }} />
          </Tooltip>
        );
      }
    }

    return '';
  }, [open, minDeposit, consumerHostBalance.result]);

  const menu = React.useMemo(
    () =>
      open
        ? [
            {
              key: 'header',
              label: (
                <div style={{ padding: '0 16px' }}>
                  <Address address={account} size="bigger"></Address>
                </div>
              ),
            },
            {
              key: 'walletBalance',
              label: (
                <div className="flex" style={{ gap: 16, padding: '16px' }}>
                  <div className="col-flex" style={{ gap: 8 }}>
                    <Typography variant="small" type="secondary">
                      Wallet balance on Base
                    </Typography>
                    {balance.result.loading ? (
                      <div style={{ lineHeight: '24px' }}>
                        <Spinner size={12}></Spinner>
                      </div>
                    ) : (
                      <Typography weight={600}>
                        {formatNumberWithLocale(formatEther(balance.result.data, 4))} {TOKEN}
                      </Typography>
                    )}
                  </div>
                  <div className="col-flex" style={{ gap: 8 }}>
                    <Typography variant="small" type="secondary">
                      Wallet balance on Ethereum
                      <Tooltip
                        color="#fff"
                        title={
                          <Typography variant="small">
                            SubQuery launched on Base network, To move assets from the Ethereum network to Base network,
                            you'll need to connect to a bridge and deposit funds.
                          </Typography>
                        }
                        overlayInnerStyle={{
                          padding: 16,
                        }}
                      >
                        <InfoCircleOutlined style={{ marginLeft: 8 }} />
                      </Tooltip>
                    </Typography>
                    {ethSqtBalance.result.loading ? (
                      <div style={{ lineHeight: '24px' }}>
                        <Spinner size={12}></Spinner>
                      </div>
                    ) : (
                      <Typography weight={600}>
                        {formatNumberWithLocale(formatEther(ethSqtBalance.result.data, 4))} {TOKEN}
                      </Typography>
                    )}
                  </div>
                </div>
              ),
            },
            {
              key: 'bridge tokens',
              label: (
                <div style={{ padding: '0 16px 8px 16px' }}>
                  <a href={BRIDGE_URL} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                    <Button
                      shape="round"
                      size="large"
                      type="primary"
                      ghost
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 10,
                      }}
                    >
                      Bridge Tokens
                      <BsBoxArrowInUpRight />
                    </Button>
                  </a>
                </div>
              ),
            },
            {
              key: 'billingBalance',
              label: (
                <div
                  style={{
                    padding: '16px',
                    borderTop: '1px solid var(--sq-gray200)',
                    borderBottom: '1px solid var(--sq-gray200)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div className="flex" style={{ width: '100%' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <Typography className="flex-center">
                        Billing Balance:
                        <Tooltip
                          title={
                            <div className="col-flex" style={{ gap: 24 }}>
                              <Typography variant="medium" style={{ color: '#fff' }}>
                                When you create Flex plan, you need to deposit SQT to your billing account from your
                                wallet.
                              </Typography>
                              <Typography variant="medium" style={{ color: '#fff' }}>
                                The funds are kept in your billing account to allow you to purchase multiple Flex plans
                                using the same funds.
                              </Typography>

                              <Typography variant="medium" style={{ color: '#fff' }}>
                                Some of your billing balance is locked in the plan, and will be unlocked shortly after
                                plan is terminated.
                              </Typography>
                            </div>
                          }
                        >
                          <BsInfoCircle
                            style={{ color: 'var(--sq-gray500)', fontSize: 14, marginLeft: 8 }}
                          ></BsInfoCircle>
                        </Tooltip>
                      </Typography>
                      {consumerHostBalance.result.loading ? (
                        <div style={{ lineHeight: '24px' }}>
                          <Spinner size={12}></Spinner>
                        </div>
                      ) : (
                        <Typography>
                          {formatNumberWithLocale(formatEther(consumerHostBalance.result.data?.balance, 4))} {TOKEN}
                          {warnDeposit}
                        </Typography>
                      )}
                    </div>
                    <span style={{ flex: 1 }}></span>
                    <Typography.Link href="/consumer/flex-plans/ongoing" type="info">
                      View Details
                    </Typography.Link>
                  </div>
                </div>
              ),
            },
            {
              key: 'addTokens',
              label: (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '8px 0',
                    borderBottom: '1px solid var(--sq-gray200)',
                  }}
                >
                  <div className={styles.dropdownItemInner}>
                    <Typography onClick={handleAddToken}>{t('header.importToken')}</Typography>
                  </div>
                  <div className={styles.dropdownItemInner}>
                    <Typography onClick={handleAddStableToken}>{t('header.importStableToken')}</Typography>
                  </div>
                </div>
              ),
            },
            {
              key: 'myProfile',
              label: (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '8px 0',
                    borderBottom: '1px solid var(--sq-gray200)',
                  }}
                >
                  <div className={styles.dropdownItemInner} onClick={handleNavAccount}>
                    {t('indexer.myProfile')}
                  </div>
                  <div className={styles.dropdownItemInner} onClick={handleNavRewards}>
                    {t('indexer.rewards')}
                  </div>
                  <div className={styles.dropdownItemInner} onClick={handleNavWithdrawn}>
                    {t('indexer.withdrawn')}
                  </div>
                </div>
              ),
            },
            {
              key: 'disconnect',
              label: (
                <div style={{ padding: '8px 0 0 0' }}>
                  <div className={styles.dropdownItemInner} onClick={handleDisconnect}>
                    <BsBoxArrowLeft style={{ marginRight: 8 }} /> {t('header.disconnect')}
                  </div>
                </div>
              ),
            },
          ]
        : [],
    [open, balance.result.loading, ethSqtBalance.result.loading, consumerHostBalance.result.loading],
  );

  return (
    <Dropdown
      onOpenChange={(val) => {
        setOpen(val);
      }}
      overlayClassName={styles.accountActionDropdown}
      menu={{ items: menu }}
      placement="bottom"
      arrow={{ pointAtCenter: true }}
    >
      <div className={styles.address}>
        <Address address={account} size="large" />
        <AiOutlineDown className={styles.downIcon} />
      </div>
    </Dropdown>
  );
};
