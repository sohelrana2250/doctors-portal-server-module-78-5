const { ObjectId } = require("mongodb");

const get_all_data = async (databaseCollection, query, page = 1, limit = 0) => {
  const result = await databaseCollection
    .find(query)
    .skip((page - 1) * limit)
    .limit(limit)
    .toArray();
  return result;
};

const post_data = async (databaseCollection, data) => {
  const result = await databaseCollection.insertOne(data);
  return result;
};

const specific_data = async (databaseCollection, data) => {
  const result = await databaseCollection.findOne(data);
  return result;
};

const update_data = async (filter, updateDoc, databaseCollection) => {
  const result = await databaseCollection.updateOne(filter, updateDoc, {
    upsert: true,
  });
  return result;
};

const delete_data = async (id, databaseCollection) => {
  const query = { _id: new ObjectId(`${id}`) };
  const result = await databaseCollection.deleteOne(query);
  return result;
};

const aggregate_data = async (
  data,
  databaseCollection,
  page = 1,
  limit = 0
) => {
  return await databaseCollection
    .aggregate(data)
    .skip((page - 1) * limit)
    .limit(limit)
    .toArray();
};

module.exports = {
  get_all_data,
  post_data,
  specific_data,
  update_data,
  delete_data,
  aggregate_data,
};
