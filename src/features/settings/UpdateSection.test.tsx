// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { useUpdates } from '../../store/updates'
import UpdateSection from './UpdateSection'

describe('UpdateSection', () => {
  afterEach(cleanup)

  it('offers in-place installation for AppImage', () => {
    useUpdates.setState({
      status: 'available',
      context: {
        currentVersion: '0.1.1',
        installKind: 'appimage',
        canInstallInPlace: true,
        executable: '/tmp/GitEasy.AppImage'
      },
      availableVersion: '0.1.2',
      notes: 'Bug fixes',
      error: null
    })

    render(<UpdateSection />)
    expect(screen.getByRole('button', { name: '下载并安装' })).toBeTruthy()
  })

  it('offers the release download page for deb installs', () => {
    useUpdates.setState({
      status: 'available',
      context: {
        currentVersion: '0.1.1',
        installKind: 'deb',
        canInstallInPlace: false,
        executable: '/usr/bin/giteasy'
      },
      availableVersion: '0.1.2',
      notes: null,
      error: null
    })

    render(<UpdateSection />)
    expect(screen.getByRole('button', { name: '前往下载' })).toBeTruthy()
  })
})
