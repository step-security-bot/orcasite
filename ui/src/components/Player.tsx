import { GraphicEq, Pause, PlayArrow } from '@mui/icons-material'
import { Box, Fab, styled } from '@mui/material'
import { useEffect, useState } from 'react'

import type { Feed } from '../generated/types'
import useIsMobile from '../hooks/useIsMobile'
import DetectionDialog from './DetectionDialog'
import MediaStreamer from './MediaStreamer'

const PlayerContainer = styled('div')`
  .video-js {
    display: none;
  }
`

const StyledButtonContainer = styled('div')`
  border-radius: 2.0625rem;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
`

export default function Player({ currentFeed }: { currentFeed?: Feed }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [controls, setControls] = useState({
    play: () => {},
    pause: () => {},
    playPause: () => {},
    getPlayerTime: () => {},
    setVolume: () => {},
  })
  const [hlsURI, setHlsURI] = useState<string>()
  const [currentXhr, setCurrentXhr] = useState<XMLHttpRequest>()
  const [timestamp, setTimestamp] = useState('')
  const [intervalId, setIntervalId] = useState<NodeJS.Timer>()

  const [debugInfo, setDebugInfo] = useState<{
    playerTime: number
    latencyHistory: number[]
  }>()

  const isMobile = useIsMobile()

  // const S3_BUCKET = process.env.S3_BUCKET
  const S3_BUCKET = 'streaming-orcasound-net'

  const getHlsUri = (timestamp: string, feed: string, bucket: string) =>
    `https://s3-us-west-2.amazonaws.com/${bucket}/${feed}/hls/${timestamp}/live.m3u8`

  const getAwsConsoleUri = (
    timestamp: string,
    nodeName: string,
    bucket: string
  ) =>
    `https://s3.console.aws.amazon.com/s3/buckets/${bucket}/${nodeName}/hls/${timestamp}/`

  const fetchTimestamp = (feed: string) => {
    const timestampURI = `https://s3-us-west-2.amazonaws.com/${S3_BUCKET}/${feed}/latest.txt`

    const xhr = new XMLHttpRequest()
    setCurrentXhr(xhr)
    xhr.open('GET', timestampURI)
    xhr.onload = () => {
      if (xhr.status === 200) {
        const newTimestamp = xhr.responseText.trim()
        if (process.env.NODE_ENV === 'development')
          console.log('Latest timestamp: ' + newTimestamp)
        if (newTimestamp !== timestamp) {
          setTimestamp(newTimestamp)
          setHlsURI(getHlsUri(newTimestamp, feed, S3_BUCKET))
          if (process.env.NODE_ENV === 'development')
            console.log(
              'New stream instance: ' + getHlsUri(newTimestamp, feed, S3_BUCKET)
            )
        }
      }
    }
    xhr.send()
  }

  const startTimestampFetcher = () => {
    stopFetcher()
    if (currentFeed && Object.keys(currentFeed).length > 0) {
      fetchTimestamp(currentFeed.nodeName)
      const intervalId = setInterval(
        () => fetchTimestamp(currentFeed.nodeName),
        10000
      )
      setIntervalId(intervalId)
    }
  }

  const stopFetcher = () => {
    if (currentXhr) currentXhr.abort()
    if (intervalId) clearInterval(intervalId)
  }

  const handleReady = (controls: any) => {
    setIsLoading(false)
    setControls(controls)
  }

  useEffect(() => {
    startTimestampFetcher()
    return () => {
      stopFetcher()
      setHlsURI(undefined)
      setIsPlaying(false)
      setIsLoading(false)
    }
  }, [currentFeed])

  return (
    <Box
      sx={{
        minHeight: 80,
        color: 'base.contrastText',
        backgroundColor: 'base.main',
        ...(isMobile && { mb: (theme) => theme.spacing(8) }),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'relative',
      }}
    >
      {isPlaying && (
        <DetectionDialog
          isPlaying={isPlaying}
          feed={currentFeed}
          timestamp={timestamp}
          getPlayerTime={controls.getPlayerTime}
          // listenerCount={this.props.listenerCount}
        >
          <Fab
            variant="extended"
            size="large"
            color="secondary"
            sx={{
              position: 'absolute',
              bottom: 100,
              left: 0,
              right: 0,
              margin: 'auto',
              maxWidth: 'max-content',

              // style to look like outlined button
              backgroundColor: 'white',
              color: 'primary.main',
              borderColor: 'primary.main',
              borderStyle: 'solid',
              borderWidth: '2px',
              '&:hover': {
                backgroundColor: 'primary.main',
                color: 'white',
              },
            }}
          >
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <GraphicEq sx={{ mr: 1 }} />
              Report sound
            </Box>
          </Fab>
        </DetectionDialog>
      )}
      <PlayerContainer sx={{ mx: 2 }}>
        <StyledButtonContainer>
          <Fab
            color="base"
            sx={{
              // set hover color manually because custom colors are broken for Fab
              // see https://github.com/mui/material-ui/issues/31063
              '&:hover': {
                backgroundColor: 'base.light',
              },
            }}
            onClick={controls.playPause}
          >
            {!isPlaying && (
              <PlayArrow
                className="icon"
                fontSize="large"
                // onClick={() =>
                //   analyticsEvents.stream.started(currentFeed.slug)
                // }
              />
            )}
            {isPlaying && (
              <Pause
                className="icon"
                fontSize="large"
                // onClick={() =>
                //   analyticsEvents.stream.paused(currentFeed.slug)
                // }
              />
            )}
          </Fab>
        </StyledButtonContainer>
        {hlsURI && (
          <MediaStreamer
            src={hlsURI}
            autoplay={true}
            onReady={handleReady}
            onLoading={() => setIsLoading(true)}
            onPlaying={() => {
              setIsLoading(false)
              setIsPlaying(true)
            }}
            onPaused={() => {
              setIsLoading(false)
              setIsPlaying(false)
            }}
            onLatencyUpdate={(newestLatency: number, playerTime: number) =>
              setDebugInfo((prevDebugInfo) => ({
                playerTime: playerTime,
                latencyHistory: (prevDebugInfo?.latencyHistory ?? []).concat(
                  newestLatency
                ),
              }))
            }
          />
        )}
      </PlayerContainer>
      <Box sx={{ mx: 2 }}>
        {currentFeed
          ? `${currentFeed.name} - ${currentFeed.nodeName}`
          : 'Player: no feed selected'}
      </Box>
      <Box sx={{ mx: 4, flexGrow: 1, textAlign: 'end' }}>
        {currentFeed &&
          `${currentFeed.locationPoint.coordinates[0]}, ${currentFeed.locationPoint.coordinates[1]}`}
      </Box>
    </Box>
  )
}