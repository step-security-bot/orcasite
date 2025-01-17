defmodule Orcasite.GlobalSetup do
  def populate_feed_streams do
    Orcasite.Radio.Feed
    |> Ash.Query.for_read(:read)
    |> Orcasite.Radio.read!()
    |> Stream.map(fn feed ->
      Orcasite.Radio.AwsClient.list_timestamps(feed, fn timestamps ->
        timestamps
        |> Enum.map(&%{feed: feed, playlist_timestamp: &1})
        |> Orcasite.Radio.bulk_create(Orcasite.Radio.FeedStream, :create)
      end)
      :ok
    end)
    |> Enum.to_list()
  end
end
