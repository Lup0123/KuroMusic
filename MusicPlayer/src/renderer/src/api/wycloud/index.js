const searchSongs = async (keyword) => {
  const response = await window.api.search(keyword)
  return response
}

export default { searchSongs }